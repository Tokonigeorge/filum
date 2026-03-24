"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, useViewport } from "reactflow";

export interface GraphNodeData {
  title: string;
  color?: string;
  noteId: string;
}

const GraphNode = ({ data }: NodeProps<GraphNodeData>) => {
  const { zoom } = useViewport();
  const isDot = zoom < 0.25;

  if (isDot) {
    return (
      <div
        className="w-3 h-3 rounded-full"
        style={{ background: data.color || "var(--text-muted)" }}
      >
        <Handle type="target" position={Position.Top} className="!opacity-0 !w-3 !h-3 !top-0 !left-0 !transform-none" />
        <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-3 !h-3 !top-0 !left-0 !transform-none" />
      </div>
    );
  }

  return (
    <div
      className="graph-pill"
      style={data.color ? { background: data.color } : undefined}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-1 !h-1" />
      <span className="truncate">{data.title || "Untitled"}</span>
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-1 !h-1" />
    </div>
  );
};

export default memo(GraphNode);
