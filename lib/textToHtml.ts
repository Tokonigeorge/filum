/**
 * Convert plain text (exported from Apple Notes via Shortcuts) to HTML.
 *
 * Handles:
 * - Unicode bullet chars (◦, •, -, *) → <ul><li>
 * - Checkmarks (✓, ✔, ☑) → styled list items
 * - Numbered lines (1. 2. etc.) → <ol><li>
 * - URLs → <a> links
 * - Blank lines → paragraph breaks
 * - Regular lines → <p> tags
 */

const URL_RE = /(https?:\/\/[^\s<]+)/g;

const linkify = (text: string): string =>
  text.replace(URL_RE, '<a href="$1" target="_blank" rel="noopener">$1</a>');

const BULLET_RE = /^[\s]*[◦•\-\*]\s+/;
const NUMBERED_RE = /^[\s]*\d+[\.\)]\s+/;
const CHECKBOX_CHECKED_RE = /^[\s]*[✓✔☑]\s*/;
const CHECKBOX_UNCHECKED_RE = /^[\s]*[☐□]\s*/;

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const plainTextToHtml = (text: string): string => {
  if (!text) return "";

  // If it already looks like HTML, return as-is
  if (/<[a-z][\s\S]*>/i.test(text)) return text;

  const lines = text.split("\n");
  const parts: string[] = [];
  let i = 0;

  const flushList = (type: "ul" | "ol", items: string[]) => {
    parts.push(`<${type}>${items.map((item) => `<li>${linkify(item)}</li>`).join("")}</${type}>`);
  };

  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip (creates separation between elements)
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Collect consecutive bullet items
    if (BULLET_RE.test(line) || CHECKBOX_CHECKED_RE.test(line) || CHECKBOX_UNCHECKED_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && (BULLET_RE.test(lines[i]) || CHECKBOX_CHECKED_RE.test(lines[i]) || CHECKBOX_UNCHECKED_RE.test(lines[i]))) {
        let cleaned = lines[i]
          .replace(BULLET_RE, "")
          .replace(CHECKBOX_CHECKED_RE, "✓ ")
          .replace(CHECKBOX_UNCHECKED_RE, "☐ ")
          .trim();
        items.push(escapeHtml(cleaned));
        i++;
      }
      flushList("ul", items);
      continue;
    }

    // Collect consecutive numbered items
    if (NUMBERED_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && NUMBERED_RE.test(lines[i])) {
        const cleaned = lines[i].replace(NUMBERED_RE, "").trim();
        items.push(escapeHtml(cleaned));
        i++;
      }
      flushList("ol", items);
      continue;
    }

    // Regular line → paragraph
    parts.push(`<p>${linkify(escapeHtml(line.trim()))}</p>`);
    i++;
  }

  return parts.join("");
};
