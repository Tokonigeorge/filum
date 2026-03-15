/**
 * Apple Notes SQLite parser.
 *
 * Reads NoteStore.sqlite entirely client-side using sql.js (WASM),
 * decompresses gzipped protobuf blobs with pako, decodes with protobufjs,
 * and converts attribute runs to HTML.
 *
 * No data leaves the browser.
 */

import initSqlJs, { type Database } from "sql.js";
import pako from "pako";
import protobuf from "protobufjs";

// Inline the proto schema so we don't need to fetch a file
const PROTO_SCHEMA = `
syntax = "proto2";

message NoteStoreProto {
  optional Document document = 2;
}

message Document {
  optional int32 version = 2;
  optional Note note = 3;
}

message Note {
  optional string note_text = 2;
  repeated AttributeRun attribute_run = 5;
}

message AttributeRun {
  optional int32 length = 1;
  optional ParagraphStyle paragraph_style = 2;
  optional Font font = 3;
  optional int32 font_weight = 5;
  optional int32 underlined = 6;
  optional int32 strikethrough = 7;
  optional int32 superscript = 8;
  optional string link = 9;
  optional Color color = 10;
  optional AttachmentInfo attachment_info = 12;
}

message ParagraphStyle {
  optional int32 style_type = 1;
  optional int32 alignment = 2;
  optional int32 indent_amount = 4;
  optional Checklist checklist = 5;
}

message Checklist {
  optional bytes uuid = 1;
  optional int32 done = 2;
}

message Font {
  optional string font_name = 1;
  optional float point_size = 2;
  optional int32 font_hints = 3;
}

message Color {
  optional float red = 1;
  optional float green = 2;
  optional float blue = 3;
  optional float alpha = 4;
}

message AttachmentInfo {
  optional string attachment_identifier = 1;
  optional string type_uti = 2;
}
`;

export interface ParsedNote {
  title: string;
  body: string; // HTML
  createdAt: number; // unix ms
  updatedAt: number; // unix ms
  snippet: string;
}

// Mac Absolute Time epoch offset (seconds between 1970-01-01 and 2001-01-01)
const MAC_EPOCH_OFFSET = 978307200;

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Style types from Apple Notes protobuf ParagraphStyle
 */
const STYLE_TYPES = {
  TITLE: 0,
  HEADING: 1,
  SUBHEADING: 2,
  MONOSPACE: 4,
  BULLET_DASH: 100,
  BULLET_DOT: 101,
  NUMBERED: 102,
  CHECKBOX: 103,
} as const;

/**
 * Convert protobuf attribute runs + note text into HTML
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const attributeRunsToHtml = (noteText: string, runs: any[]): string => {
  if (!runs || runs.length === 0) return `<p>${escapeHtml(noteText)}</p>`;

  const parts: string[] = [];
  let offset = 0;
  let inList: string | null = null; // "ul" | "ol" | null

  const closeList = () => {
    if (inList) {
      parts.push(`</${inList}>`);
      inList = null;
    }
  };

  for (const run of runs) {
    const len = run.length || 0;
    const chunk = noteText.slice(offset, offset + len);
    offset += len;

    if (!chunk) continue;

    const ps = run.paragraphStyle;
    const styleType = ps?.styleType;
    const isBold = run.fontWeight === 1 || run.fontWeight === 3;
    const isItalic = run.fontWeight === 2 || run.fontWeight === 3;
    const isUnderlined = run.underlined === 1;
    const isStrikethrough = run.strikethrough === 1;
    const link = run.link;

    // Build inline formatting
    let text = escapeHtml(chunk.replace(/\n$/, ""));
    if (!text && chunk === "\n") {
      // Line break between blocks
      closeList();
      offset = offset; // no-op, just process next run
      continue;
    }

    if (isBold) text = `<strong>${text}</strong>`;
    if (isItalic) text = `<em>${text}</em>`;
    if (isUnderlined) text = `<u>${text}</u>`;
    if (isStrikethrough) text = `<s>${text}</s>`;
    if (link) text = `<a href="${escapeHtml(link)}" target="_blank" rel="noopener">${text}</a>`;

    // Handle block-level styles
    if (styleType === STYLE_TYPES.TITLE) {
      closeList();
      parts.push(`<h1>${text}</h1>`);
    } else if (styleType === STYLE_TYPES.HEADING) {
      closeList();
      parts.push(`<h2>${text}</h2>`);
    } else if (styleType === STYLE_TYPES.SUBHEADING) {
      closeList();
      parts.push(`<h3>${text}</h3>`);
    } else if (styleType === STYLE_TYPES.MONOSPACE) {
      closeList();
      parts.push(`<pre><code>${text}</code></pre>`);
    } else if (
      styleType === STYLE_TYPES.BULLET_DASH ||
      styleType === STYLE_TYPES.BULLET_DOT
    ) {
      if (inList !== "ul") {
        closeList();
        parts.push("<ul>");
        inList = "ul";
      }
      parts.push(`<li>${text}</li>`);
    } else if (styleType === STYLE_TYPES.NUMBERED) {
      if (inList !== "ol") {
        closeList();
        parts.push("<ol>");
        inList = "ol";
      }
      parts.push(`<li>${text}</li>`);
    } else if (styleType === STYLE_TYPES.CHECKBOX) {
      if (inList !== "ul") {
        closeList();
        parts.push('<ul data-type="taskList">');
        inList = "ul";
      }
      const checked = ps?.checklist?.done === 1;
      parts.push(
        `<li data-type="taskItem" data-checked="${checked}">${checked ? "☑" : "☐"} ${text}</li>`
      );
    } else {
      // Regular paragraph text
      closeList();
      // Split by newlines within the chunk for multiple paragraphs
      const lines = text.split("\n").filter(Boolean);
      for (const line of lines) {
        parts.push(`<p>${line}</p>`);
      }
      if (lines.length === 0 && text) {
        parts.push(`<p>${text}</p>`);
      }
    }
  }

  closeList();
  return parts.join("");
};

/**
 * Parse an Apple Notes SQLite database file and return all notes as HTML.
 */
export const parseAppleNotesDb = async (
  sqliteBuffer: ArrayBuffer,
  walBuffer?: ArrayBuffer,
  shmBuffer?: ArrayBuffer
): Promise<ParsedNote[]> => {
  // Initialize sql.js with WASM
  const SQL = await initSqlJs({
    locateFile: (file: string) =>
      `https://sql.js.org/dist/${file}`,
  });

  // Open the database
  const db: Database = new SQL.Database(new Uint8Array(sqliteBuffer));

  // Load the protobuf schema
  const root = protobuf.parse(PROTO_SCHEMA).root;
  const NoteStoreProto = root.lookupType("NoteStoreProto");

  // Query notes with their body data
  const query = `
    SELECT
      n.Z_PK,
      n.ZTITLE1 AS title,
      n.ZSNIPPET AS snippet,
      n.ZCREATIONDATE1 AS created,
      n.ZMODIFICATIONDATE1 AS modified,
      nd.ZDATA AS body_data
    FROM ZICCLOUDSYNCINGOBJECT AS n
    INNER JOIN ZICNOTEDATA AS nd ON nd.ZNOTE = n.Z_PK
    WHERE n.ZTITLE1 IS NOT NULL
      AND n.ZMARKEDFORDELETION != 1
    ORDER BY n.ZMODIFICATIONDATE1 DESC
  `;

  let results;
  try {
    results = db.exec(query);
  } catch {
    // Try legacy schema
    const legacyQuery = `
      SELECT
        n.Z_PK,
        n.ZTITLE AS title,
        nb.ZHTMLSTRING AS body_html,
        n.ZCREATIONDATE AS created,
        n.ZMODIFICATIONDATE AS modified
      FROM ZNOTE AS n
      LEFT JOIN ZNOTEBODY AS nb ON nb.ZNOTE = n.Z_PK
      WHERE n.ZTITLE IS NOT NULL
      ORDER BY n.ZMODIFICATIONDATE DESC
    `;
    results = db.exec(legacyQuery);
    db.close();

    if (!results.length || !results[0].values.length) return [];

    return results[0].values.map((row) => ({
      title: (row[1] as string) || "Untitled",
      body: (row[2] as string) || "",
      createdAt: ((row[3] as number) + MAC_EPOCH_OFFSET) * 1000,
      updatedAt: ((row[4] as number) + MAC_EPOCH_OFFSET) * 1000,
      snippet: "",
    }));
  }

  db.close();

  if (!results.length || !results[0].values.length) return [];

  const notes: ParsedNote[] = [];

  for (const row of results[0].values) {
    const title = (row[1] as string) || "Untitled";
    const snippet = (row[2] as string) || "";
    const created = ((row[3] as number) + MAC_EPOCH_OFFSET) * 1000;
    const modified = ((row[4] as number) + MAC_EPOCH_OFFSET) * 1000;
    const bodyData = row[5] as Uint8Array | null;

    let body = "";

    if (bodyData) {
      try {
        // Decompress gzip
        const decompressed = pako.inflate(bodyData);
        // Decode protobuf
        const message = NoteStoreProto.decode(decompressed);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj = NoteStoreProto.toObject(message) as any;

        const noteText = obj?.document?.note?.noteText || "";
        const attributeRuns = obj?.document?.note?.attributeRun || [];

        body = attributeRunsToHtml(noteText, attributeRuns);
      } catch (e) {
        // Fallback: use snippet as body
        body = `<p>${escapeHtml(snippet)}</p>`;
      }
    }

    notes.push({ title, body, createdAt: created, updatedAt: modified, snippet });
  }

  return notes;
};
