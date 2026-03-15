"use client";

import { useState, useCallback, useRef } from "react";
import { Search, Upload, FolderSync } from "lucide-react";
import { getEmbedding } from "@/lib/ai";
import { cosineSimilarity } from "@/lib/similarity";
import type { Note } from "@/lib/db";
import { setSyncFolder, getSyncHandle, clearSyncFolder, syncFromFolder } from "@/lib/sync";

interface TopBarProps {
  noteCount: number;
  allNotes: Note[];
  onSelectNote: (id: string) => void;
  onImportClick: () => void;
  onSync: () => void;
}

const TopBar = ({
  noteCount,
  allNotes,
  onSelectNote,
  onImportClick,
  onSync,
}: TopBarProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Note[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [hasSyncFolder, setHasSyncFolder] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useState(() => {
    getSyncHandle().then((h) => setHasSyncFolder(!!h));
  });

  const handleSyncClick = async () => {
    if (hasSyncFolder) {
      setSyncing(true);
      await syncFromFolder();
      setSyncing(false);
      onSync();
    } else {
      const handle = await setSyncFolder();
      if (handle) {
        setHasSyncFolder(true);
        setSyncing(true);
        await syncFromFolder();
        setSyncing(false);
        onSync();
      }
    }
  };

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setShowResults(false);
        return;
      }
      setSearching(true);
      setShowResults(true);

      const embedding = await getEmbedding(q);
      if (!embedding) {
        // Fallback: title substring match
        const filtered = allNotes.filter((n) =>
          n.title.toLowerCase().includes(q.toLowerCase())
        );
        setResults(filtered.slice(0, 8));
        setSearching(false);
        return;
      }

      const scored = allNotes
        .filter((n) => n.embedding)
        .map((n) => ({
          note: n,
          score: cosineSimilarity(embedding, n.embedding!),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      setResults(scored.map((s) => s.note));
      setSearching(false);
    },
    [allNotes]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 500);
  };

  return (
    <div className="topbar">
      <div className="text-sm font-mono font-bold text-neutral-300 tracking-wide">
        filum
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded px-3 py-1.5">
            <Search size={14} className="text-neutral-500" />
            <input
              type="text"
              value={query}
              onChange={handleChange}
              onFocus={() => results.length > 0 && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              placeholder="search notes..."
              className="bg-transparent text-sm font-mono text-neutral-300 outline-none w-48 placeholder:text-neutral-600"
            />
            {searching && (
              <div className="w-3 h-3 border border-neutral-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {showResults && results.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-neutral-900 border border-neutral-800 rounded shadow-xl z-50 max-h-64 overflow-y-auto">
              {results.map((note) => (
                <button
                  key={note.id}
                  onMouseDown={() => {
                    onSelectNote(note.id);
                    setShowResults(false);
                    setQuery("");
                  }}
                  className="w-full text-left px-3 py-2 text-sm font-mono text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 truncate transition-colors"
                >
                  {note.title || "Untitled"}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="text-xs font-mono text-neutral-600">
          {noteCount} note{noteCount !== 1 ? "s" : ""}
        </span>

        <button
          onClick={handleSyncClick}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-mono text-neutral-400 hover:text-neutral-200 border border-neutral-800 rounded hover:border-neutral-600 transition-colors disabled:opacity-40"
          title={hasSyncFolder ? "Sync from folder" : "Set sync folder"}
        >
          <FolderSync size={14} className={syncing ? "animate-spin" : ""} />
          {hasSyncFolder ? "sync" : "set sync folder"}
        </button>

        <button
          onClick={onImportClick}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-mono text-neutral-400 hover:text-neutral-200 border border-neutral-800 rounded hover:border-neutral-600 transition-colors"
        >
          <Upload size={14} />
          import
        </button>
      </div>
    </div>
  );
};

export default TopBar;
