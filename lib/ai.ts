/**
 * Client-side wrappers for AI API calls.
 * All calls go through Next.js API routes — the Gemini API key
 * never leaves the server.
 */

import type { Note } from "./db";

export const getEmbedding = async (text: string): Promise<number[] | null> => {
  try {
    const res = await fetch("/api/ai/embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.embedding;
  } catch {
    return null;
  }
};

export const getSummary = async (body: string): Promise<string | null> => {
  try {
    const res = await fetch("/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.summary;
  } catch {
    return null;
  }
};

/**
 * Processes a note through the AI pipeline: embedding + summarization.
 * Private notes never leave the device — no embedding, no summarization, no API calls.
 */
export const processNote = async (
  note: Note
): Promise<{ embedding: number[] | null; summary: string | null }> => {
  if (note.isPrivate) return { embedding: null, summary: null };

  const text = `${note.title}\n${note.body}`;
  const [embedding, summary] = await Promise.all([
    getEmbedding(text),
    getSummary(note.body),
  ]);

  return { embedding, summary };
};
