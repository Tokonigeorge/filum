"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { X, Lock, Unlock, Trash2 } from "lucide-react";
import type { Note } from "@/lib/db";
import { updateNote, deleteNote } from "@/lib/db";
import { processNote } from "@/lib/ai";
import { findRelatedNotes } from "@/lib/similarity";

interface EditorPanelProps {
  note: Note;
  allNotes: Note[];
  onClose: () => void;
  onUpdate: () => void;
  onDelete: (id: string) => void;
}

const EditorPanel = ({
  note,
  allNotes,
  onClose,
  onUpdate,
  onDelete,
}: EditorPanelProps) => {
  const [title, setTitle] = useState(note.title);
  const [isPrivate, setIsPrivate] = useState(note.isPrivate);
  const [relatedNotes, setRelatedNotes] = useState<Note[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing..." }),
    ],
    content: note.body,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm max-w-none font-mono focus:outline-none min-h-[200px] px-1",
      },
    },
    onUpdate: ({ editor }) => {
      scheduleSave(title, editor.getHTML());
    },
  });

  const scheduleSave = useCallback(
    (currentTitle: string, currentBody: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        const updatedNote: Note = {
          ...note,
          title: currentTitle,
          body: currentBody,
          isPrivate,
        };

        const { embedding, summary } = await processNote(updatedNote);
        await updateNote(note.id, {
          title: currentTitle,
          body: currentBody,
          isPrivate,
          ...(embedding !== null ? { embedding } : {}),
          ...(summary !== null ? { summary } : {}),
        });
        onUpdate();
      }, 800);
    },
    [note, isPrivate, onUpdate]
  );

  // Compute related notes
  useEffect(() => {
    if (!note.embedding) {
      setRelatedNotes([]);
      return;
    }
    const embeddings = allNotes
      .filter((n) => n.id !== note.id && n.embedding)
      .map((n) => ({ id: n.id, embedding: n.embedding! }));
    const relatedIds = findRelatedNotes(note.embedding, embeddings);
    setRelatedNotes(allNotes.filter((n) => relatedIds.includes(n.id)));
  }, [note, allNotes]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (editor) scheduleSave(newTitle, editor.getHTML());
  };

  const handlePrivacyToggle = async () => {
    const newPrivate = !isPrivate;
    setIsPrivate(newPrivate);
    await updateNote(note.id, { isPrivate: newPrivate });
    if (newPrivate) {
      // Clear AI data when going private
      await updateNote(note.id, { embedding: null, summary: null });
    } else if (editor) {
      // Re-process when unlocking
      const updatedNote: Note = { ...note, isPrivate: false, body: editor.getHTML() };
      const { embedding, summary } = await processNote(updatedNote);
      if (embedding || summary) {
        await updateNote(note.id, {
          ...(embedding ? { embedding } : {}),
          ...(summary ? { summary } : {}),
        });
      }
    }
    onUpdate();
  };

  const handleDelete = async () => {
    await deleteNote(note.id);
    onDelete(note.id);
    onClose();
  };

  return (
    <div className="editor-panel">
      <div className="flex items-center justify-between mb-4 gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="bg-transparent text-lg font-bold font-mono text-neutral-100 flex-1 outline-none border-none placeholder:text-neutral-600"
          placeholder="Untitled"
        />
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrivacyToggle}
            className="p-2 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
            title={isPrivate ? "Unlock note (enable AI)" : "Lock note (disable AI)"}
          >
            {isPrivate ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
          <button
            onClick={handleDelete}
            className="p-2 rounded hover:bg-neutral-800 text-neutral-400 hover:text-red-400 transition-colors"
            title="Delete note"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {isPrivate && (
        <div className="text-xs text-neutral-500 font-mono mb-3 px-1 flex items-center gap-1.5">
          <Lock size={10} />
          this note is not processed by AI
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {relatedNotes.length > 0 && (
        <div className="mt-6 pt-4 border-t border-neutral-800">
          <div className="text-xs text-neutral-500 font-mono mb-2">
            related notes
          </div>
          <div className="space-y-1">
            {relatedNotes.map((rn) => (
              <div
                key={rn.id}
                className="text-sm text-neutral-400 font-mono truncate hover:text-neutral-200 cursor-pointer"
              >
                {rn.title || "Untitled"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EditorPanel;
