"use client";

import { useEffect, useState } from "react";
import {
  X, FolderSync, Trash2, RefreshCw, Keyboard,
  FileUp, Copy, Check,
} from "lucide-react";
import {
  getSyncHandle,
  setSyncFolder,
  clearSyncFolder,
  syncFromFolder,
} from "@/lib/sync";
import { db, createNote, getAllNotes } from "@/lib/db";
import { parseAppleNotesDb } from "@/lib/appleNotesParser";

interface SettingsPanelProps {
  onClose: () => void;
  onSync: () => void;
  onShowShortcuts: () => void;
}

const SYNC_COMMAND = `mkdir -p ~/Documents/filum-sync && cp "$HOME/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite" "$HOME/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite-wal" "$HOME/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite-shm" ~/Documents/filum-sync/ 2>/dev/null; echo "Done"`;


const SettingsPanel = ({ onClose, onSync, onShowShortcuts }: SettingsPanelProps) => {
  const [hasSyncFolder, setHasSyncFolder] = useState(false);
  const [copied, setCopied] = useState(false);
  const [syncOnLoad, setSyncOnLoad] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    getSyncHandle().then((h) => setHasSyncFolder(!!h));
    db.table("syncMeta")
      .get("syncOnLoad")
      .then((meta) => setSyncOnLoad(meta?.value ?? true));
  }, []);

  // --- Folder sync (existing Shortcuts approach) ---

  const handleSetSyncFolder = async () => {
    const handle = await setSyncFolder();
    if (handle) {
      setHasSyncFolder(true);
      setStatus("Sync folder set. Syncing...");
      setSyncing(true);
      const result = await syncFromFolder();
      setSyncing(false);
      setStatus(`Imported ${result.imported} notes, skipped ${result.skipped}.`);
      onSync();
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setStatus("Syncing...");
    const result = await syncFromFolder();
    setSyncing(false);
    setStatus(`Imported ${result.imported} notes, skipped ${result.skipped}.`);
    onSync();
  };

  const handleClearAndResync = async () => {
    if (!confirm("This will delete all notes and re-import. Continue?")) return;
    setClearing(true);
    setStatus("Clearing all notes...");
    await db.table("notes").clear();
    await db.table("canvasNotes").clear();
    await db.table("syncMeta").delete("lastSyncAt");
    setStatus("Re-syncing...");
    setSyncing(true);
    const result = await syncFromFolder();
    setSyncing(false);
    setClearing(false);
    setStatus(`Fresh import: ${result.imported} notes.`);
    onSync();
  };

  const handleClearSyncFolder = async () => {
    await clearSyncFolder();
    setHasSyncFolder(false);
    setStatus("Sync folder removed.");
  };

  const handleToggleSyncOnLoad = async () => {
    const newVal = !syncOnLoad;
    setSyncOnLoad(newVal);
    await db.table("syncMeta").put({ key: "syncOnLoad", value: newVal });
  };

  // --- Apple Notes direct import ---

  const copyCommand = async () => {
    await navigator.clipboard.writeText(SYNC_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAppleNotesImport = async () => {
    try {
      // Let user pick the NoteStore.sqlite file
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: "SQLite Database",
            accept: { "application/x-sqlite3": [".sqlite"] },
          },
        ],
        multiple: false,
      });

      setImporting(true);
      setStatus("Reading Apple Notes database...");

      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();

      // Try to also read WAL file from the same directory if possible
      // (user may have picked from filum-sync folder)

      setStatus("Parsing notes...");
      const parsedNotes = await parseAppleNotesDb(buffer);

      if (parsedNotes.length === 0) {
        setStatus("No notes found in the database.");
        setImporting(false);
        return;
      }

      // Check for existing notes to avoid duplicates
      const existing = await getAllNotes();
      const existingTitles = new Set(existing.map((n) => n.title));

      let imported = 0;
      let skipped = 0;

      for (const note of parsedNotes) {
        if (existingTitles.has(note.title)) {
          skipped++;
          continue;
        }
        await createNote({
          title: note.title,
          body: note.body,
        });
        imported++;
      }

      setImporting(false);
      setStatus(
        `Imported ${imported} notes with formatting preserved. Skipped ${skipped} duplicates.`
      );
      onSync();
    } catch (e) {
      setImporting(false);
      if ((e as Error).name !== "AbortError") {
        setStatus(`Error: ${(e as Error).message}`);
      }
    }
  };

  const handleClearAndImportAppleNotes = async () => {
    if (!confirm("This will delete all notes and re-import from Apple Notes. Continue?")) return;
    setClearing(true);
    setStatus("Clearing all notes...");
    await db.table("notes").clear();
    await db.table("canvasNotes").clear();
    setClearing(false);
    await handleAppleNotesImport();
  };

  return (
    <div className="editor-panel">
      <div className="flex items-center justify-between mb-6 gap-2">
        <span className="text-sm font-mono font-bold text-neutral-200">
          Settings
        </span>
        <button
          onClick={onClose}
          className="p-2 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Apple Notes Direct Import */}
      <div className="space-y-3">
        <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
          Apple Notes (direct)
        </div>
        <p className="text-xs font-mono text-neutral-600 leading-relaxed">
          Run this in Terminal, then click import below.
        </p>

        <div className="space-y-2">
          <div className="relative">
            <pre className="text-[10px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 rounded p-2.5 pr-9 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
              {SYNC_COMMAND}
            </pre>
            <button
              onClick={copyCommand}
              className="absolute top-2 right-2 p-1 rounded hover:bg-neutral-700 text-neutral-500 hover:text-neutral-300 transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>

          <button
            onClick={handleAppleNotesImport}
            disabled={importing}
            className="settings-btn w-full justify-center"
          >
            <FileUp size={13} className={importing ? "animate-pulse" : ""} />
            {importing ? "Importing..." : "Import from Apple Notes"}
          </button>

          <button
            onClick={handleClearAndImportAppleNotes}
            disabled={importing || clearing}
            className="settings-btn settings-btn--danger w-full justify-center"
          >
            <Trash2 size={13} />
            {clearing ? "Clearing..." : "Clear & re-import"}
          </button>
        </div>
      </div>

      {/* Folder Sync (Shortcuts approach) */}
      <div className="space-y-3 mt-8 pt-4 border-t border-neutral-800">
        <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
          Folder Sync (Shortcuts)
        </div>

        <div className="space-y-2">
          <div className="text-xs font-mono text-neutral-400">
            {hasSyncFolder ? "Sync folder is set" : "No sync folder set"}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSetSyncFolder} className="settings-btn">
              <FolderSync size={13} />
              {hasSyncFolder ? "Change" : "Set folder"}
            </button>
            {hasSyncFolder && (
              <button
                onClick={handleClearSyncFolder}
                className="settings-btn settings-btn--danger"
              >
                <X size={13} />
                Remove
              </button>
            )}
          </div>
        </div>

        {hasSyncFolder && (
          <div className="space-y-2 pt-2 border-t border-neutral-800">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="settings-btn w-full justify-center"
            >
              <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync now"}
            </button>

            <button
              onClick={handleClearAndResync}
              disabled={syncing || clearing}
              className="settings-btn settings-btn--danger w-full justify-center"
            >
              <Trash2 size={13} />
              {clearing ? "Clearing..." : "Clear & re-sync"}
            </button>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-mono text-neutral-400">
                Sync on load
              </span>
              <button
                onClick={handleToggleSyncOnLoad}
                className={`w-9 h-5 rounded-full transition-colors relative ${
                  syncOnLoad ? "bg-neutral-600" : "bg-neutral-800"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-neutral-300 transition-transform ${
                    syncOnLoad ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      {status && (
        <div className="text-xs font-mono text-neutral-500 mt-4 pt-3 border-t border-neutral-800">
          {status}
        </div>
      )}

      {/* General */}
      <div className="space-y-3 mt-8 pt-4 border-t border-neutral-800">
        <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
          General
        </div>
        <button
          onClick={() => {
            onClose();
            onShowShortcuts();
          }}
          className="settings-btn w-full justify-center"
        >
          <Keyboard size={13} />
          Keyboard shortcuts
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
