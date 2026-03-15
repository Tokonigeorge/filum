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
  x?: number;
  y?: number;
}

const db = new Dexie("filum") as Dexie & {
  notes: EntityTable<Note, "id">;
};

db.version(1).stores({
  notes: "id, title, createdAt, updatedAt",
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
