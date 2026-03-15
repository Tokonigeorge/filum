import { getAllNotes, setLinksForNote, type NoteLink } from "./db";

/** Regex to match [[wikilink]] and [[wikilink|display text]] in HTML content */
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/** Extract wikilink titles from note body (which may be HTML) */
export const extractWikilinks = (body: string): string[] => {
  // Strip HTML tags to get raw text for parsing
  const text = body.replace(/<[^>]*>/g, "");
  const titles: string[] = [];
  let match;

  while ((match = WIKILINK_RE.exec(text)) !== null) {
    const title = match[1].trim();
    if (title) titles.push(title);
  }

  return Array.from(new Set(titles)); // deduplicate
};

/**
 * Parse a note's body for [[wikilinks]], resolve them to note IDs,
 * and update the links table.
 */
export const parseAndSaveLinks = async (sourceId: string, body: string): Promise<void> => {
  const linkedTitles = extractWikilinks(body);

  if (linkedTitles.length === 0) {
    await setLinksForNote(sourceId, []);
    return;
  }

  const allNotes = await getAllNotes();
  const titleMap = new Map(
    allNotes.map((n) => [n.title.toLowerCase(), n])
  );

  const links: Omit<NoteLink, "id">[] = [];

  for (const title of linkedTitles) {
    const target = titleMap.get(title.toLowerCase());
    if (target && target.id !== sourceId) {
      links.push({
        sourceId,
        targetId: target.id,
        targetTitle: target.title,
      });
    }
  }

  await setLinksForNote(sourceId, links);
};
