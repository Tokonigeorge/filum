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
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" style={{ background: "var(--border-hover)", borderColor: "var(--border-hover)" }} />

      {/* Header row: title + controls */}
      <div className="flex items-center gap-2 mb-2">
        <div className="text-xs font-bold truncate font-mono flex-1" style={{ color: "var(--text)" }}>
          {data.title || "Untitled"}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {data.isPrivate && (
            <Lock size={10} style={{ color: "var(--text-dim)" }} />
          )}
          {data.onRemove && data.noteId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onRemove!(data.noteId!);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all"
              style={{ color: "var(--text-dim)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
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

      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: "var(--border-hover)", borderColor: "var(--border-hover)" }} />
    </div>
  );
};

export default memo(NoteNode);
