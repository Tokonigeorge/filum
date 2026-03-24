"use client";

import { useState, useCallback } from "react";
import { Search, Upload, Settings } from "lucide-react";
import type { Note } from "@/lib/db";

interface TopBarProps {
  noteCount: number;
  allNotes: Note[];
  onSelectNote: (id: string) => void;
  onImportClick: () => void;
  onSettingsClick: () => void;
}

const TopBar = ({
  noteCount,
  allNotes,
  onSelectNote,
  onImportClick,
  onSettingsClick,
}: TopBarProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Note[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const search = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setShowResults(false);
        return;
      }
      setSearching(true);
      setShowResults(true);

      const lower = q.toLowerCase();
      const filtered = allNotes.filter(
        (n) =>
          n.title.toLowerCase().includes(lower) ||
          (n.body && n.body.toLowerCase().includes(lower))
      );
      setResults(filtered.slice(0, 8));
      setSearching(false);
    },
    [allNotes]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    search(val);
  };

  return (
    <div className="topbar">
      <div className="text-sm font-mono font-bold tracking-wide" style={{ color: "var(--text)" }}>
        filum
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <div
            className="flex items-center gap-2 rounded px-3 py-1.5"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          >
            <Search size={14} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              value={query}
              onChange={handleChange}
              onFocus={() => results.length > 0 && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              placeholder="search notes..."
              className="bg-transparent text-sm font-mono outline-none w-48"
              style={{ color: "var(--text)", caretColor: "var(--text)" }}
            />
            {searching && (
              <div className="w-3 h-3 rounded-full animate-spin" style={{ border: "1px solid var(--text-muted)", borderTopColor: "transparent" }} />
            )}
          </div>

          {showResults && results.length > 0 && (
            <div
              className="absolute top-full mt-1 left-0 right-0 rounded shadow-xl z-50 max-h-64 overflow-y-auto"
              style={{ background: "var(--panel-bg)", border: "1px solid var(--border)" }}
            >
              {results.map((note) => (
                <button
                  key={note.id}
                  onMouseDown={() => {
                    onSelectNote(note.id);
                    setShowResults(false);
                    setQuery("");
                  }}
                  className="w-full text-left px-3 py-2 text-sm font-mono truncate transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-tertiary)";
                    e.currentTarget.style.color = "var(--text)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  {note.title || "Untitled"}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>
          {noteCount} note{noteCount !== 1 ? "s" : ""}
        </span>

        <button
          onClick={onImportClick}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-mono rounded transition-colors"
          style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text)";
            e.currentTarget.style.borderColor = "var(--border-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-muted)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          <Upload size={14} />
          import
        </button>

        <button
          onClick={onSettingsClick}
          className="p-1.5 rounded transition-colors editor-action-btn"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
};

export default TopBar;
