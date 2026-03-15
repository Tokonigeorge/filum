"use client";

import { useEffect, useState } from "react";
import { X, FolderSync, Trash2, RefreshCw, Keyboard } from "lucide-react";
import {
  getSyncHandle,
  setSyncFolder,
  clearSyncFolder,
  syncFromFolder,
} from "@/lib/sync";
import { db } from "@/lib/db";

interface SettingsPanelProps {
  onClose: () => void;
  onSync: () => void;
  onShowShortcuts: () => void;
}

const SettingsPanel = ({ onClose, onSync, onShowShortcuts }: SettingsPanelProps) => {
  const [hasSyncFolder, setHasSyncFolder] = useState(false);
  const [syncOnLoad, setSyncOnLoad] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    getSyncHandle().then((h) => setHasSyncFolder(!!h));
    db.table("syncMeta")
      .get("syncOnLoad")
      .then((meta) => setSyncOnLoad(meta?.value ?? true));
  }, []);

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
    if (!confirm("This will delete all notes and re-import from the sync folder. Continue?")) return;
    setClearing(true);
    setStatus("Clearing all notes...");

    // Clear all notes and canvas state
    await db.table("notes").clear();
    await db.table("canvasNotes").clear();

    // Reset last sync timestamp so everything re-imports
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

      {/* Sync section */}
      <div className="space-y-4">
        <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
          Sync
        </div>

        {/* Sync folder */}
        <div className="space-y-2">
          <div className="text-xs font-mono text-neutral-400">
            {hasSyncFolder ? "Sync folder is set" : "No sync folder set"}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSetSyncFolder}
              className="settings-btn"
            >
              <FolderSync size={13} />
              {hasSyncFolder ? "Change folder" : "Set sync folder"}
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

        {/* Sync actions */}
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

            {/* Sync on load toggle */}
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

        {status && (
          <div className="text-xs font-mono text-neutral-500 pt-1">
            {status}
          </div>
        )}
      </div>

      {/* Shortcuts section */}
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
