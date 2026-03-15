"use client";

import { useState } from "react";
import { FileText, Lock, ChevronDown, ChevronRight } from "lucide-react";
import type { Note } from "@/lib/db";

interface SidebarProps {
  notes: Note[];
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
}

const Sidebar = ({ notes, selectedNoteId, onSelectNote }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  const sortedNotes = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="sidebar">
      <div
        className="flex items-center gap-1.5 px-3 py-2 cursor-pointer select-none hover:bg-neutral-900 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <ChevronRight size={12} className="text-neutral-500" />
        ) : (
          <ChevronDown size={12} className="text-neutral-500" />
        )}
        <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
          notes
        </span>
        <span className="text-xs font-mono text-neutral-600 ml-auto">
          {notes.length}
        </span>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {sortedNotes.map((note) => (
            <button
              key={note.id}
              onClick={() => onSelectNote(note.id)}
              className={`sidebar-item ${
                note.id === selectedNoteId ? "sidebar-item--active" : ""
              }`}
            >
              <FileText size={13} className="flex-shrink-0 text-neutral-600" />
              <span className="truncate flex-1 text-left">
                {note.title || "Untitled"}
              </span>
              {note.isPrivate && (
                <Lock size={10} className="flex-shrink-0 text-neutral-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
