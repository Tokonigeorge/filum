"use client";

import { useRef, useState } from "react";
import { FileText, Lock, ChevronDown, ChevronRight, GripVertical, Plus } from "lucide-react";
import type { Note } from "@/lib/db";
import { updateNote } from "@/lib/db";

interface SidebarProps {
  notes: Note[];
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onReorder: () => void;
  onNewNote: () => void;
}

const Sidebar = ({ notes, selectedNoteId, onSelectNote, onReorder, onNewNote }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemId = useRef<string | null>(null);

  const sortedNotes = [...notes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const handleDragStart = (noteId: string) => {
    dragItemId.current = noteId;
  };

  const handleDragOver = (e: React.DragEvent, noteId: string) => {
    e.preventDefault();
    if (dragItemId.current !== noteId) {
      setDragOverId(noteId);
    }
  };

  const handleDrop = async (targetId: string) => {
    const sourceId = dragItemId.current;
    if (!sourceId || sourceId === targetId) {
      setDragOverId(null);
      dragItemId.current = null;
      return;
    }

    const ids = sortedNotes.map((n) => n.id);
    const sourceIdx = ids.indexOf(sourceId);
    const targetIdx = ids.indexOf(targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    // Reorder
    ids.splice(sourceIdx, 1);
    ids.splice(targetIdx, 0, sourceId);

    // Persist new sort orders
    await Promise.all(
      ids.map((id, i) => updateNote(id, { sortOrder: i } as any))
    );

    setDragOverId(null);
    dragItemId.current = null;
    onReorder();
  };

  const handleDragEnd = () => {
    setDragOverId(null);
    dragItemId.current = null;
  };

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
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNewNote();
          }}
          className="p-0.5 rounded hover:bg-neutral-800 text-neutral-600 hover:text-neutral-300 transition-colors"
          title="New note (Cmd+N)"
        >
          <Plus size={13} />
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {sortedNotes.map((note) => (
            <div
              key={note.id}
              draggable
              onDragStart={() => handleDragStart(note.id)}
              onDragOver={(e) => handleDragOver(e, note.id)}
              onDrop={() => handleDrop(note.id)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelectNote(note.id)}
              className={`sidebar-item ${
                note.id === selectedNoteId ? "sidebar-item--active" : ""
              } ${note.id === dragOverId ? "sidebar-item--dragover" : ""}`}
            >
              <GripVertical size={10} className="flex-shrink-0 text-neutral-700 cursor-grab" />
              <FileText size={13} className="flex-shrink-0 text-neutral-600" />
              <span className="truncate flex-1 text-left">
                {note.title || "Untitled"}
              </span>
              {note.isPrivate && (
                <Lock size={10} className="flex-shrink-0 text-neutral-600" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
