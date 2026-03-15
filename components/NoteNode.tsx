"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Lock, X } from "lucide-react";

export interface NoteNodeData {
  title: string;
  body: string;
  isPrivate: boolean;
  selected?: boolean;
  color?: string;
  onRemove?: (id: string) => void;
  noteId?: string;
}

const NoteNode = ({ data }: NodeProps<NoteNodeData>) => {
  return (
    <div
      className={`note-node group ${data.isPrivate ? "note-node--private" : ""} ${
        data.selected ? "note-node--selected" : ""
      }`}
      style={data.color ? { background: data.color } : undefined}
    >
      <Handle type="target" position={Position.Top} className="!bg-neutral-600 !border-neutral-500 !w-2 !h-2" />

      {/* Header row: title + controls */}
      <div className="flex items-center gap-2 mb-2">
        <div className="text-xs font-bold text-neutral-100 truncate font-mono flex-1">
          {data.title || "Untitled"}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {data.isPrivate && (
            <Lock size={10} className="text-neutral-600" />
          )}
          {data.onRemove && data.noteId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onRemove!(data.noteId!);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-neutral-800 text-neutral-600 hover:text-neutral-300 transition-all"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Body preview — rendered HTML */}
      {data.body && (
        <div
          className="note-node__body tiptap"
          dangerouslySetInnerHTML={{ __html: data.body }}
        />
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-neutral-600 !border-neutral-500 !w-2 !h-2" />
    </div>
  );
};

export default memo(NoteNode);
