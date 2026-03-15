"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type NodeTypes,
  useReactFlow,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";

import NoteNode, { type NoteNodeData } from "@/components/NoteNode";
import Sidebar from "@/components/Sidebar";
import EditorPanel from "@/components/EditorPanel";
import ImportPanel from "@/components/ImportPanel";
import TopBar from "@/components/TopBar";
import ShortcutsOverlay from "@/components/ShortcutsOverlay";
import SettingsPanel from "@/components/SettingsPanel";
import {
  getAllNotes,
  createNote,
  getCanvasNotes,
  addToCanvas,
  removeFromCanvas,
  updateCanvasPosition,
  type Note,
  db,
} from "@/lib/db";
import { syncFromFolder } from "@/lib/sync";

const nodeTypes: NodeTypes = { noteNode: NoteNode };

const NODE_W = 280;
const NODE_H = 120;

/** Find a position that doesn't overlap existing canvas nodes */
const findFreePosition = (
  x: number,
  y: number,
  existing: Map<string, { x: number; y: number }>
): { x: number; y: number } => {
  const positions = Array.from(existing.values());

  const overlaps = (px: number, py: number) =>
    positions.some(
      (p) => Math.abs(p.x - px) < NODE_W + 20 && Math.abs(p.y - py) < NODE_H + 20
    );

  if (!overlaps(x, y)) return { x, y };

  // Spiral outward to find a free spot
  for (let ring = 1; ring <= 10; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        const nx = x + dx * (NODE_W + 30);
        const ny = y + dy * (NODE_H + 30);
        if (!overlaps(nx, ny)) return { x: nx, y: ny };
      }
    }
  }
  return { x: x + Math.random() * 200, y: y + Math.random() * 200 };
};

const GraphCanvas = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [canvasNoteIds, setCanvasNoteIds] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, , onEdgesChange] = useEdgesState([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const reactFlowInstance = useReactFlow();
  const initialized = useRef(false);

  // Remove a note from the canvas (not delete it)
  const handleRemoveFromCanvas = useCallback(
    async (noteId: string) => {
      await removeFromCanvas(noteId);
      setCanvasNoteIds((prev) => {
        const next = new Map(prev);
        next.delete(noteId);
        return next;
      });
      if (selectedNote?.id === noteId) setSelectedNote(null);
    },
    [selectedNote]
  );

  // Build React Flow nodes from canvas state
  useEffect(() => {
    const canvasNotes = notes.filter((n) => canvasNoteIds.has(n.id));
    const newNodes: Node[] = canvasNotes.map((note) => {
      const pos = canvasNoteIds.get(note.id)!;
      return {
        id: note.id,
        type: "noteNode",
        position: { x: pos.x, y: pos.y },
        data: {
          title: note.title,
          body: note.body,
          isPrivate: note.isPrivate,
          selected: note.id === selectedNote?.id,
          noteId: note.id,
          onRemove: handleRemoveFromCanvas,
        } as NoteNodeData,
      };
    });
    setNodes(newNodes);
  }, [notes, canvasNoteIds, selectedNote?.id, handleRemoveFromCanvas, setNodes]);

  // Load all notes + restore canvas state from IndexedDB
  const loadNotes = useCallback(async () => {
    const [allNotes, savedCanvas] = await Promise.all([
      getAllNotes(),
      getCanvasNotes(),
    ]);
    setNotes(allNotes);
    setCanvasNoteIds(new Map(savedCanvas.map((c) => [c.noteId, { x: c.x, y: c.y }])));
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      // Check syncOnLoad setting before syncing
      db.table("syncMeta")
        .get("syncOnLoad")
        .then((meta: { value?: boolean } | undefined) => {
          const shouldSync = meta?.value ?? true;
          if (shouldSync) {
            return syncFromFolder().catch(() => {});
          }
        })
        .finally(() => loadNotes());
    }
  }, [loadNotes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+N — new note
      if (meta && e.key === "n") {
        e.preventDefault();
        const { x, y, zoom } = reactFlowInstance.getViewport();
        const cx = (-x + window.innerWidth / 2) / zoom;
        const cy = (-y + window.innerHeight / 2) / zoom;
        const pos = findFreePosition(cx, cy, canvasNoteIds);
        createNote({ title: "Untitled" }).then(async (note) => {
          await addToCanvas(note.id, pos.x, pos.y);
          setSelectedNote(note);
          loadNotes();
        });
      }

      // Cmd+/ — toggle shortcuts overlay
      if (meta && e.key === "/") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }

      // Escape — close editor panel
      if (e.key === "Escape") {
        setSelectedNote(null);
        setShowImport(false);
        setShowShortcuts(false);
      }

      // Backspace/Delete — remove selected note from canvas (not delete)
      if ((e.key === "Backspace" || e.key === "Delete") && selectedNote) {
        const active = document.activeElement;
        if (active?.tagName === "INPUT" || active?.tagName === "TEXTAREA" || active?.closest(".tiptap")) return;
        handleRemoveFromCanvas(selectedNote.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reactFlowInstance, canvasNoteIds, selectedNote, handleRemoveFromCanvas, loadNotes]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const note = notes.find((n) => n.id === node.id);
      if (note) setSelectedNote(note);
    },
    [notes]
  );

  // Double-click canvas → create a new note and add it to canvas
  const onPaneDoubleClick = useCallback(
    async (event: React.MouseEvent) => {
      const raw = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const position = findFreePosition(raw.x, raw.y, canvasNoteIds);

      const note = await createNote({ title: "Untitled" });
      await addToCanvas(note.id, position.x, position.y);

      setSelectedNote(note);
      loadNotes();
    },
    [reactFlowInstance, loadNotes, canvasNoteIds]
  );

  // Save position when dragging stops
  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      await updateCanvasPosition(node.id, node.position.x, node.position.y);
      setCanvasNoteIds((prev) => {
        const next = new Map(prev);
        next.set(node.id, { x: node.position.x, y: node.position.y });
        return next;
      });
    },
    []
  );

  // Sidebar click → add note to canvas if not already there, select it
  const handleSelectNote = useCallback(
    async (id: string) => {
      const note = notes.find((n) => n.id === id);
      if (!note) return;

      setSelectedNote(note);

      if (!canvasNoteIds.has(id)) {
        // Place near center of current viewport
        const { x, y, zoom } = reactFlowInstance.getViewport();
        const centerX = (-x + window.innerWidth / 2) / zoom;
        const centerY = (-y + window.innerHeight / 2) / zoom;
        const pos = findFreePosition(centerX, centerY, canvasNoteIds);

        await addToCanvas(id, pos.x, pos.y);
        setCanvasNoteIds((prev) => {
          const next = new Map(prev);
          next.set(id, { x: pos.x, y: pos.y });
          return next;
        });
      } else {
        // Already on canvas — pan to it
        const pos = canvasNoteIds.get(id)!;
        reactFlowInstance.setCenter(pos.x, pos.y, {
          zoom: 1.2,
          duration: 500,
        });
      }
    },
    [notes, canvasNoteIds, reactFlowInstance]
  );

  return (
    <div className="h-screen w-screen flex flex-col" style={{ background: "#080808" }}>
      <TopBar
        noteCount={notes.length}
        allNotes={notes}
        onSelectNote={handleSelectNote}
        onImportClick={() => setShowImport(true)}
        onSettingsClick={() => setShowSettings(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          notes={notes}
          selectedNoteId={selectedNote?.id ?? null}
          onSelectNote={handleSelectNote}
          onReorder={loadNotes}
        />

        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelectedNote(null)}
            onDoubleClick={onPaneDoubleClick}
            onNodeDragStop={onNodeDragStop}
            fitView
            minZoom={0.2}
            maxZoom={2}
            defaultEdgeOptions={{ type: "default" }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1a1a1a" gap={32} size={1} />
          </ReactFlow>

          {selectedNote && !showImport && (
            <EditorPanel
              key={selectedNote.id}
              note={selectedNote}
              allNotes={notes}
              onClose={() => setSelectedNote(null)}
              onUpdate={loadNotes}
              onDelete={() => {
                setSelectedNote(null);
                loadNotes();
              }}
            />
          )}

          {showImport && (
            <ImportPanel
              onClose={() => setShowImport(false)}
              onImport={() => {
                loadNotes();
                setShowImport(false);
              }}
            />
          )}

          {showSettings && (
            <SettingsPanel
              onClose={() => setShowSettings(false)}
              onSync={loadNotes}
              onShowShortcuts={() => setShowShortcuts(true)}
            />
          )}

          {/* Shortcuts help button */}
          <button
            onClick={() => setShowShortcuts(true)}
            className="absolute bottom-4 right-4 z-30 w-7 h-7 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600 transition-colors flex items-center justify-center text-xs font-mono"
            title="Keyboard shortcuts (Cmd+/)"
          >
            ?
          </button>
        </div>
      </div>

      {showShortcuts && (
        <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
};

const Home = () => {
  return (
    <ReactFlowProvider>
      <GraphCanvas />
    </ReactFlowProvider>
  );
};

export default Home;
