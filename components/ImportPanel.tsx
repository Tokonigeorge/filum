"use client";

import { useCallback, useState } from "react";
import { X, Upload } from "lucide-react";
import { createNote } from "@/lib/db";
import { plainTextToHtml } from "@/lib/textToHtml";

interface ImportPanelProps {
  onClose: () => void;
  onImport: () => void;
}

const ImportPanel = ({ onClose, onImport }: ImportPanelProps) => {
  const [pasteText, setPasteText] = useState("");
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState("");

  const importSingleNote = async (title: string, body: string) => {
    await createNote({ title, body: plainTextToHtml(body) });
  };

  const handlePasteImport = async () => {
    if (!pasteText.trim()) return;
    setImporting(true);
    setStatus("Importing...");
    const title =
      pasteText.trim().split("\n")[0].slice(0, 60) || "Imported note";
    await importSingleNote(title, pasteText.trim());
    setStatus("Done!");
    setPasteText("");
    setImporting(false);
    onImport();
  };

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      setImporting(true);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setStatus(`Importing ${i + 1}/${files.length}: ${file.name}`);
        const text = await file.text();
        const title = file.name.replace(/\.(txt|md)$/, "") || "Imported note";
        await importSingleNote(title, text);
      }

      setStatus(`Imported ${files.length} note${files.length > 1 ? "s" : ""}`);
      setImporting(false);
      onImport();
    },
    [onImport]
  );

  return (
    <div className="editor-panel">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-bold font-mono text-neutral-100">
          import
        </h2>
        <button
          onClick={onClose}
          className="p-2 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* File upload */}
      <div className="mb-6">
        <label className="flex items-center gap-2 px-4 py-3 border border-dashed border-neutral-700 rounded cursor-pointer hover:border-neutral-500 transition-colors">
          <Upload size={16} className="text-neutral-400" />
          <span className="text-sm font-mono text-neutral-400">
            upload .txt or .md files
          </span>
          <input
            type="file"
            multiple
            accept=".txt,.md"
            onChange={handleFileUpload}
            className="hidden"
            disabled={importing}
          />
        </label>
      </div>

      {/* Paste text */}
      <div className="mb-4">
        <div className="text-xs text-neutral-500 font-mono mb-2">
          or paste text
        </div>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          className="w-full h-40 bg-neutral-900 border border-neutral-800 rounded p-3 text-sm font-mono text-neutral-300 resize-none focus:outline-none focus:border-neutral-600 placeholder:text-neutral-700"
          placeholder="Paste note content here..."
          disabled={importing}
        />
        <button
          onClick={handlePasteImport}
          disabled={importing || !pasteText.trim()}
          className="mt-2 px-4 py-2 text-sm font-mono bg-neutral-800 text-neutral-300 rounded hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          import as note
        </button>
      </div>

      {status && (
        <div className="text-xs text-neutral-500 font-mono mt-2">{status}</div>
      )}

      {/* Apple Notes instructions */}
      <div className="mt-6 pt-4 border-t border-neutral-800">
        <div className="text-xs text-neutral-500 font-mono mb-2">
          importing from Apple Notes
        </div>
        <div className="text-xs text-neutral-600 font-mono leading-relaxed">
          In Apple Shortcuts, create a shortcut that gets all notes and saves
          them as .txt files, then import the folder here.
        </div>
      </div>
    </div>
  );
};

export default ImportPanel;
