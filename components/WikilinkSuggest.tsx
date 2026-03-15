"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { Note } from "@/lib/db";

interface WikilinkSuggestProps {
  editor: Editor;
  allNotes: Note[];
  currentNoteId: string;
}

/**
 * Watches the editor for [[ being typed and shows an autocomplete popup.
 * When a note is selected, inserts [[Note Title]] at the cursor.
 */
const WikilinkSuggest = ({ editor, allNotes, currentNoteId }: WikilinkSuggestProps) => {
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredNotes = allNotes
    .filter((n) => n.id !== currentNoteId)
    .filter((n) =>
      query ? n.title.toLowerCase().includes(query.toLowerCase()) : true
    )
    .slice(0, 8);

  const insertWikilink = useCallback(
    (title: string) => {
      if (!editor) return;

      const { state } = editor;
      const { from } = state.selection;

      // Find the [[ before cursor by scanning backwards in the document text
      const textBefore = state.doc.textBetween(
        Math.max(0, from - 200),
        from,
        "\n",
        "\n"
      );
      const bracketIndex = textBefore.lastIndexOf("[[");
      if (bracketIndex === -1) return;

      const deleteFrom = from - (textBefore.length - bracketIndex);
      const deleteTo = from;

      editor
        .chain()
        .focus()
        .deleteRange({ from: deleteFrom, to: deleteTo })
        .insertContent(`[[${title}]]`)
        .run();

      setActive(false);
      setQuery("");
    },
    [editor]
  );

  useEffect(() => {
    if (!editor) return;

    const checkForBrackets = () => {
      const { state } = editor;
      const { from } = state.selection;

      if (from < 2) {
        setActive(false);
        return;
      }

      // Get text in the current block before cursor
      const $pos = state.doc.resolve(from);
      const start = $pos.start();
      const textBefore = state.doc.textBetween(start, from, "", "");

      const bracketIndex = textBefore.lastIndexOf("[[");
      const closingIndex = textBefore.lastIndexOf("]]");

      // Active if [[ exists and no ]] after it
      if (bracketIndex !== -1 && (closingIndex === -1 || closingIndex < bracketIndex)) {
        const searchQuery = textBefore.slice(bracketIndex + 2);

        // Don't activate if query is too long (probably not a wikilink)
        if (searchQuery.length > 60) {
          setActive(false);
          return;
        }

        setQuery(searchQuery);
        setActive(true);
        setSelectedIndex(0);

        // Position the popup near the cursor
        try {
          const coords = editor.view.coordsAtPos(from);
          const scrollContainer = editor.view.dom.closest(".flex-1.overflow-y-auto");
          if (scrollContainer) {
            const containerRect = scrollContainer.getBoundingClientRect();
            setPosition({
              top: coords.bottom - containerRect.top + scrollContainer.scrollTop + 4,
              left: Math.min(
                coords.left - containerRect.left,
                containerRect.width - 220
              ),
            });
          }
        } catch {
          // coords can fail at edge positions
        }
      } else {
        setActive(false);
      }
    };

    editor.on("update", checkForBrackets);
    editor.on("selectionUpdate", checkForBrackets);

    return () => {
      editor.off("update", checkForBrackets);
      editor.off("selectionUpdate", checkForBrackets);
    };
  }, [editor]);

  // Keyboard navigation
  useEffect(() => {
    if (!active || !editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredNotes.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filteredNotes[selectedIndex]) {
        e.preventDefault();
        insertWikilink(filteredNotes[selectedIndex].title);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setActive(false);
      }
    };

    // Capture phase so we intercept before Tiptap
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [active, filteredNotes, selectedIndex, insertWikilink, editor]);

  if (!active || filteredNotes.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute z-50 bg-neutral-900 border border-neutral-700 rounded shadow-xl max-h-48 overflow-y-auto"
      style={{ top: position.top, left: position.left, minWidth: 200 }}
    >
      {filteredNotes.map((note, i) => (
        <button
          key={note.id}
          onMouseDown={(e) => {
            e.preventDefault();
            insertWikilink(note.title);
          }}
          className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors ${
            i === selectedIndex
              ? "bg-neutral-800 text-neutral-200"
              : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          }`}
        >
          {note.title || "Untitled"}
        </button>
      ))}
    </div>
  );
};

export default WikilinkSuggest;
