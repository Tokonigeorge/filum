"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Lock, X } from "lucide-react";

export interface NoteNodeData {
  title: string;
  summary: string | null;
  isPrivate: boolean;
  selected?: boolean;
  onDelete?: (id: string) => void;
  noteId?: string;
}

const NoteNode = ({ data }: NodeProps<NoteNodeData>) => {
  return (
    <div
      className={`note-node group ${data.isPrivate ? "note-node--private" : ""} ${
        data.selected ? "note-node--selected" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-neutral-600 !border-neutral-500 !w-2 !h-2" />

      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-neutral-100 truncate font-mono">
            {data.title || "Untitled"}
          </div>
          {data.summary && (
            <div className="text-xs text-neutral-500 mt-1 line-clamp-2 font-mono leading-relaxed">
              {data.summary}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {data.isPrivate && (
            <Lock size={10} className="text-neutral-600" />
          )}
          {data.onDelete && data.noteId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onDelete!(data.noteId!);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-neutral-800 text-neutral-600 hover:text-red-400 transition-all"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-neutral-600 !border-neutral-500 !w-2 !h-2" />
    </div>
  );
};

export default memo(NoteNode);
