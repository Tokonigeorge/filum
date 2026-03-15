/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, createNote, getAllNotes } from "./db";
import { plainTextToHtml } from "./textToHtml";

declare global {
  interface Window {
    showDirectoryPicker(options?: { mode?: string }): Promise<FileSystemDirectoryHandle>;
    showOpenFilePicker(options?: {
      types?: { description: string; accept: Record<string, string[]> }[];
      multiple?: boolean;
    }): Promise<FileSystemFileHandle[]>;
  }
}

/**
 * On-open sync using the File System Access API.
 *
 * The user picks a folder once (e.g. ~/Documents/filum-sync/) and we store
 * the directory handle in IndexedDB. On each app open, we re-read that folder
 * for new or modified .txt/.md files and import them as notes.
 *
 * The Apple Notes workflow: user creates a Shortcut that exports notes as .txt
 * files to this folder. filum picks them up automatically on next open.
 */

const HANDLE_KEY = "syncDirHandle";

export const getSyncHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  const meta = await db.table("syncMeta").get(HANDLE_KEY);
  return meta?.value ?? null;
};

export const setSyncFolder = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    const handle = await window.showDirectoryPicker({ mode: "read" });
    await db.table("syncMeta").put({ key: HANDLE_KEY, value: handle });
    return handle;
  } catch {
    return null;
  }
};

export const clearSyncFolder = async (): Promise<void> => {
  await db.table("syncMeta").delete(HANDLE_KEY);
};

const getLastSyncAt = async (): Promise<number> => {
  const meta = await db.table("syncMeta").get("lastSyncAt");
  return meta?.value ?? 0;
};

const setLastSyncAt = async (timestamp: number): Promise<void> => {
  await db.table("syncMeta").put({ key: "lastSyncAt", value: timestamp });
};

export const syncFromFolder = async (): Promise<{ imported: number; skipped: number }> => {
  const handle = await getSyncHandle() as any;
  if (!handle) return { imported: 0, skipped: 0 };

  // Re-request permission if needed (requires user gesture on first visit per session)
  const permission = await handle.queryPermission({ mode: "read" });
  if (permission !== "granted") {
    const requested = await handle.requestPermission({ mode: "read" });
    if (requested !== "granted") return { imported: 0, skipped: 0 };
  }

  const since = await getLastSyncAt();
  const existingNotes = await getAllNotes();
  const existingTitles = new Set(existingNotes.map((n) => n.title));

  let imported = 0;
  let skipped = 0;
  let latestModified = since;

  for await (const [name, entry] of handle.entries()) {
    if (entry.kind !== "file") continue;
    if (!/\.(txt|md|html)$/i.test(name)) continue;

    const file = await entry.getFile();
    if (file.lastModified <= since) continue;

    const title = name.replace(/\.(txt|md|html)$/i, "");
    if (existingTitles.has(title)) {
      skipped++;
      continue;
    }

    const content = await file.text();
    const isHtml = /\.html$/i.test(name) || content.trimStart().startsWith("<");
    const body = isHtml ? content : plainTextToHtml(content);
    await createNote({ title, body });

    imported++;
    if (file.lastModified > latestModified) {
      latestModified = file.lastModified;
    }
  }

  if (imported > 0) {
    await setLastSyncAt(latestModified);
  }

  return { imported, skipped };
};
