"use client";

import { X } from "lucide-react";

interface ShortcutsOverlayProps {
  onClose: () => void;
}

const shortcuts = [
  { keys: ["Cmd", "N"], action: "New note" },
  { keys: ["Esc"], action: "Close panel" },
  { keys: ["Del"], action: "Remove note from canvas" },
  { keys: ["Double-click"], action: "New note at position" },
  { keys: ["Cmd", "B"], action: "Bold" },
  { keys: ["Cmd", "I"], action: "Italic" },
  { keys: ["Cmd", "U"], action: "Underline" },
  { keys: ["Cmd", "Shift", "X"], action: "Strikethrough" },
  { keys: ["Cmd", "Shift", "7"], action: "Ordered list" },
  { keys: ["Cmd", "Shift", "8"], action: "Bullet list" },
  { keys: ["Cmd", "E"], action: "Inline code" },
];

const ShortcutsOverlay = ({ onClose }: ShortcutsOverlayProps) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    onClick={onClose}
  >
    <div
      className="bg-[#111] border border-neutral-800 rounded-lg p-6 w-[360px] max-h-[80vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-mono font-bold text-neutral-200">
          Keyboard Shortcuts
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <div className="space-y-2">
        {shortcuts.map((s) => (
          <div
            key={s.action}
            className="flex items-center justify-between py-1.5"
          >
            <span className="text-xs font-mono text-neutral-400">
              {s.action}
            </span>
            <div className="flex items-center gap-1">
              {s.keys.map((k) => (
                <kbd
                  key={k}
                  className="px-1.5 py-0.5 text-[10px] font-mono bg-neutral-800 border border-neutral-700 rounded text-neutral-300"
                >
                  {k}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default ShortcutsOverlay;
