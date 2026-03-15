"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import WikilinkDecoration from "@/lib/wikilink";
import WikilinkSuggest from "./WikilinkSuggest";
import { parseAndSaveLinks } from "@/lib/linkParser";
import { getBacklinks, getNoteById } from "@/lib/db";
import {
  X, Lock, Unlock, Trash2,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, List, ListOrdered, Code, Quote,
  CheckSquare, Table as TableIcon, Braces,
} from "lucide-react";
import type { Note } from "@/lib/db";
import { updateNote, deleteNote } from "@/lib/db";

interface EditorPanelProps {
  note: Note;
  allNotes: Note[];
  onClose: () => void;
  onUpdate: () => void;
  onDelete: (id: string) => void;
  onSelectNote: (id: string) => void;
}

const EditorPanel = ({
  note,
  allNotes,
  onClose,
  onUpdate,
  onSelectNote,
  onDelete,
}: EditorPanelProps) => {
  const [title, setTitle] = useState(note.title);
  const [isPrivate, setIsPrivate] = useState(note.isPrivate);
  const [color, setColor] = useState(note.color || "");
  const [backlinks, setBacklinks] = useState<{ id: string; title: string }[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef(title);
  titleRef.current = title;

  // Load backlinks
  useEffect(() => {
    getBacklinks(note.id).then(async (links) => {
      const items: { id: string; title: string }[] = [];
      for (const link of links) {
        const source = await getNoteById(link.sourceId);
        if (source) items.push({ id: source.id, title: source.title });
      }
      setBacklinks(items);
    });
  }, [note.id]);

  const save = useCallback(
    (currentTitle: string, currentBody: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        await updateNote(note.id, {
          title: currentTitle,
          body: currentBody,
          isPrivate,
        });
        // Parse wikilinks and update links table
        await parseAndSaveLinks(note.id, currentBody);
        onUpdate();
      }, 300);
    },
    [note.id, isPrivate, onUpdate]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: {
          HTMLAttributes: { class: "monospace-block" },
        },
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      WikilinkDecoration,
      Placeholder.configure({ placeholder: "Start writing..." }),
    ],
    content: note.body,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm max-w-none font-mono focus:outline-none min-h-[300px] px-1",
      },
    },
    onUpdate: ({ editor }) => {
      save(titleRef.current, editor.getHTML());
    },
  });

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (editor) save(newTitle, editor.getHTML());
  };

  const handlePrivacyToggle = async () => {
    const newPrivate = !isPrivate;
    setIsPrivate(newPrivate);
    await updateNote(note.id, { isPrivate: newPrivate });
    onUpdate();
  };

  const handleDelete = async () => {
    await deleteNote(note.id);
    onDelete(note.id);
    onClose();
  };

  const insertTable = () => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  // Toolbar button helper
  const ToolBtn = ({
    onClick,
    active,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`p-1.5 rounded transition-colors ${
        active
          ? "bg-neutral-700 text-neutral-100"
          : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
      }`}
      title={title}
    >
      {children}
    </button>
  );

  return (
    <div className="editor-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-2">
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

      {/* Color picker */}
      <div className="flex items-center gap-1.5 mb-3">
        {[
          { value: "", swatch: "#333", label: "Default" },
          { value: "#2d1a1e", swatch: "#c47a8a", label: "Rose" },
          { value: "#1f2d1a", swatch: "#7ac47a", label: "Green" },
          { value: "#1a1f2d", swatch: "#7a8ac4", label: "Blue" },
          { value: "#2d261a", swatch: "#c4a87a", label: "Amber" },
          { value: "#251a2d", swatch: "#a87ac4", label: "Purple" },
          { value: "#1a2d2b", swatch: "#7ac4be", label: "Teal" },
        ].map((c) => (
          <button
            key={c.value}
            onClick={async () => {
              setColor(c.value);
              await updateNote(note.id, { color: c.value });
              onUpdate();
            }}
            className={`w-5 h-5 rounded-full border-2 transition-all ${
              color === c.value ? "border-neutral-300 scale-110" : "border-transparent hover:border-neutral-500"
            }`}
            style={{ background: c.swatch }}
            title={c.label}
          />
        ))}
      </div>

      {/* Formatting toolbar */}
      {editor && (
        <div className="flex items-center gap-0.5 mb-3 pb-3 border-b border-neutral-800 flex-wrap">
          <ToolBtn
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold (Cmd+B)"
          >
            <Bold size={14} />
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic (Cmd+I)"
          >
            <Italic size={14} />
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            title="Underline (Cmd+U)"
          >
            <UnderlineIcon size={14} />
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            title="Strikethrough"
          >
            <Strikethrough size={14} />
          </ToolBtn>

          <div className="w-px h-4 bg-neutral-800 mx-1" />

          <ToolBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
            title="Heading 1"
          >
            <Heading1 size={14} />
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Heading 2"
          >
            <Heading2 size={14} />
          </ToolBtn>

          <div className="w-px h-4 bg-neutral-800 mx-1" />

          <ToolBtn
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet List"
          >
            <List size={14} />
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Ordered List"
          >
            <ListOrdered size={14} />
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            active={editor.isActive("taskList")}
            title="Checklist"
          >
            <CheckSquare size={14} />
          </ToolBtn>

          <div className="w-px h-4 bg-neutral-800 mx-1" />

          <ToolBtn
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive("code")}
            title="Inline Code"
          >
            <Code size={14} />
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive("codeBlock")}
            title="Monospace Block"
          >
            <Braces size={14} />
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            title="Blockquote"
          >
            <Quote size={14} />
          </ToolBtn>

          <div className="w-px h-4 bg-neutral-800 mx-1" />

          <ToolBtn
            onClick={insertTable}
            active={editor.isActive("table")}
            title="Insert Table"
          >
            <TableIcon size={14} />
          </ToolBtn>
        </div>
      )}

      {/* Editor body — scrollable */}
      <div className="flex-1 overflow-y-auto relative">
        <EditorContent editor={editor} />
        {editor && (
          <WikilinkSuggest
            editor={editor}
            allNotes={allNotes}
            currentNoteId={note.id}
          />
        )}
      </div>

      {/* Backlinks */}
      {backlinks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-neutral-800">
          <div className="text-xs font-mono text-neutral-500 mb-2">
            {backlinks.length} backlink{backlinks.length !== 1 ? "s" : ""}
          </div>
          <div className="space-y-1">
            {backlinks.map((bl) => (
              <div
                key={bl.id}
                className="text-xs font-mono text-neutral-400 hover:text-neutral-200 cursor-pointer truncate py-0.5"
                onClick={() => onSelectNote(bl.id)}
              >
                ← {bl.title || "Untitled"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EditorPanel;
