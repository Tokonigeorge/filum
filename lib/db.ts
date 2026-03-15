import Dexie, { type EntityTable } from "dexie";

/**
 * All note data lives in IndexedDB via Dexie — nothing is stored on a server.
 *
 * The `embedding` field is a vector representation of the note's content, generated
 * by Gemini's text-embedding-004 model. Embeddings encode semantic meaning into
 * a high-dimensional vector space: notes about similar topics end up as nearby
 * vectors, which lets us auto-discover relationships without manual tagging.
 *
 * When a note is saved, we call the /api/ai/embed endpoint to get its embedding,
 * then store it right here on the note. The graph view reads these embeddings to
 * compute cosine similarity and draw edges between related notes.
 */

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  embedding: number[] | null;
  summary: string | null;
  isPrivate: boolean;
  color?: string;
  sortOrder?: number;
  x?: number;
  y?: number;
}

export interface CanvasNote {
  noteId: string;
  x: number;
  y: number;
}

export interface NoteLink {
  id: string;
  sourceId: string;
  targetId: string;
  targetTitle: string;
}

export interface SyncMeta {
  key: string;
  value: unknown;
}

const db = new Dexie("filum") as Dexie & {
  notes: EntityTable<Note, "id">;
  canvasNotes: EntityTable<CanvasNote, "noteId">;
  noteLinks: EntityTable<NoteLink, "id">;
  syncMeta: EntityTable<SyncMeta, "key">;
};

db.version(4).stores({
  notes: "id, title, createdAt, updatedAt",
  canvasNotes: "noteId",
  noteLinks: "id, sourceId, targetId, targetTitle",
  syncMeta: "key",
});

export { db };

export const generateId = (): string => {
  return crypto.randomUUID();
};

export const createNote = async (
  partial: Partial<Note> & { title: string }
): Promise<Note> => {
  const now = Date.now();
  const note: Note = {
    id: generateId(),
    title: partial.title,
    body: partial.body ?? "",
    createdAt: now,
    updatedAt: now,
    embedding: null,
    summary: null,
    isPrivate: partial.isPrivate ?? false,
    x: partial.x,
    y: partial.y,
  };
  await db.notes.add(note);
  return note;
};

export const updateNote = async (
  id: string,
  changes: Partial<Omit<Note, "id" | "createdAt">>
): Promise<void> => {
  await db.notes.update(id, { ...changes, updatedAt: Date.now() });
};

export const deleteNote = async (id: string): Promise<void> => {
  await db.notes.delete(id);
};

export const getAllNotes = async (): Promise<Note[]> => {
  return db.notes.toArray();
};

export const getNoteById = async (id: string): Promise<Note | undefined> => {
  return db.notes.get(id);
};

// Canvas state — which notes are visible on the canvas and where

export const getCanvasNotes = async (): Promise<CanvasNote[]> => {
  return db.canvasNotes.toArray();
};

export const addToCanvas = async (noteId: string, x: number, y: number): Promise<void> => {
  await db.canvasNotes.put({ noteId, x, y });
};

export const removeFromCanvas = async (noteId: string): Promise<void> => {
  await db.canvasNotes.delete(noteId);
};

export const updateCanvasPosition = async (noteId: string, x: number, y: number): Promise<void> => {
  await db.canvasNotes.update(noteId, { x, y });
};

// Note links — wikilink relationships

/** Get all notes that link TO a given note (backlinks) */
export const getBacklinks = async (noteId: string): Promise<NoteLink[]> => {
  return db.noteLinks.where("targetId").equals(noteId).toArray();
};

/** Get all notes that a given note links FROM (forward links) */
export const getForwardLinks = async (noteId: string): Promise<NoteLink[]> => {
  return db.noteLinks.where("sourceId").equals(noteId).toArray();
};

/** Replace all links for a source note */
export const setLinksForNote = async (sourceId: string, links: Omit<NoteLink, "id">[]): Promise<void> => {
  await db.noteLinks.where("sourceId").equals(sourceId).delete();
  if (links.length > 0) {
    await db.noteLinks.bulkAdd(
      links.map((l) => ({ ...l, id: generateId() }))
    );
  }
};

/** Get all links (for graph view) */
export const getAllLinks = async (): Promise<NoteLink[]> => {
  return db.noteLinks.toArray();
};
