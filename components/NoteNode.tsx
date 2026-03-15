"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Lock } from "lucide-react";

export interface NoteNodeData {
  title: string;
  summary: string | null;
  isPrivate: boolean;
  selected?: boolean;
}

const NoteNode = ({ data }: NodeProps<NoteNodeData>) => {
  return (
    <div
      className={`note-node ${data.isPrivate ? "note-node--private" : ""} ${
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
        {data.isPrivate && (
          <Lock size={12} className="text-neutral-500 mt-0.5 flex-shrink-0" />
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-neutral-600 !border-neutral-500 !w-2 !h-2" />
    </div>
  );
};

export default memo(NoteNode);
