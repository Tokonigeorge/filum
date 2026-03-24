"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  useReactFlow,
  ReactFlowProvider,
  ConnectionMode,
} from "reactflow";
import "reactflow/dist/style.css";

import NoteNode, { type NoteNodeData } from "@/components/NoteNode";
import GraphNode, { type GraphNodeData } from "@/components/GraphNode";
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
  setLinksForNote,
  getAllLinks,
  getForwardLinks,
} from "@/lib/db";
import { syncFromFolder } from "@/lib/sync";
import { computeForceLayout } from "@/lib/graphLayout";

const nodeTypes: NodeTypes = { noteNode: NoteNode, graphNode: GraphNode };

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
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<"dark" | "paper" | "light">("dark");
  const [graphMode, setGraphMode] = useState(false);
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
          color: note.color,
          noteId: note.id,
          onRemove: handleRemoveFromCanvas,
        } as NoteNodeData,
      };
    });
    setNodes(newNodes);
  }, [notes, canvasNoteIds, selectedNote?.id, handleRemoveFromCanvas, setNodes]);

  // Load all notes + restore canvas state + links from IndexedDB
  const loadNotes = useCallback(async () => {
    const [allNotes, savedCanvas, links] = await Promise.all([
      getAllNotes(),
      getCanvasNotes(),
      getAllLinks(),
    ]);
    setNotes(allNotes);
    setCanvasNoteIds(new Map(savedCanvas.map((c) => [c.noteId, { x: c.x, y: c.y }])));

    // Build edges from links (only for notes currently on canvas)
    const canvasIds = new Set(savedCanvas.map((c) => c.noteId));
    const newEdges: Edge[] = links
      .filter((l) => canvasIds.has(l.sourceId) && canvasIds.has(l.targetId))
      .map((l) => ({
        id: `${l.sourceId}-${l.targetId}`,
        source: l.sourceId,
        target: l.targetId,
        animated: false,
        style: { stroke: "#444", strokeWidth: 1.5 },
      }));
    setEdges(newEdges);
  }, [setEdges]);

  // Load and apply theme
  useEffect(() => {
    db.table("syncMeta").get("theme").then((meta: { value?: string } | undefined) => {
      const saved = (meta?.value as "dark" | "paper" | "light") || "dark";
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    });
  }, []);

  const handleSetTheme = useCallback(async (t: "dark" | "paper" | "light") => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    await db.table("syncMeta").put({ key: "theme", value: t });
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

  // Drag from one node handle to another → create a link
  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return;

      const sourceNote = notes.find((n) => n.id === connection.source);
      const targetNote = notes.find((n) => n.id === connection.target);
      if (!sourceNote || !targetNote) return;

      // Get existing forward links and add the new one
      const existing = await getForwardLinks(connection.source);
      const alreadyLinked = existing.some((l) => l.targetId === connection.target);
      if (alreadyLinked) return;

      const allLinks = [
        ...existing.map((l) => ({ sourceId: l.sourceId, targetId: l.targetId, targetTitle: l.targetTitle })),
        { sourceId: connection.source, targetId: connection.target!, targetTitle: targetNote.title },
      ];
      await setLinksForNote(connection.source, allLinks);
      loadNotes();
    },
    [notes, loadNotes]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const note = notes.find((n) => n.id === node.id);
      if (note) setSelectedNote(note);
    },
    [notes]
  );

  // Toggle graph view — show all notes with force-directed layout
  const toggleGraphView = useCallback(async () => {
    if (graphMode) {
      // Exit graph mode — restore saved canvas
      setGraphMode(false);
      loadNotes();
      return;
    }

    setGraphMode(true);
    const allLinks = await getAllLinks();

    const layout = computeForceLayout(
      notes.map((n) => n.id),
      allLinks
    );

    // Show ALL notes on canvas with computed positions
    const graphNodes: Node[] = notes.map((note) => {
      const pos = layout.positions.get(note.id) || { x: 0, y: 0 };
      return {
        id: note.id,
        type: "graphNode",
        position: { x: pos.x, y: pos.y },
        data: {
          title: note.title,
          color: note.color,
          noteId: note.id,
        } as GraphNodeData,
      };
    });

    const graphEdges: Edge[] = allLinks.map((l) => ({
      id: `${l.sourceId}-${l.targetId}`,
      source: l.sourceId,
      target: l.targetId,
      animated: false,
      style: { stroke: "var(--edge-color)", strokeWidth: 1.5 },
    }));

    setNodes(graphNodes);
    setEdges(graphEdges);

    // Fit view, then clamp zoom so pills are visible (not dots)
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.3, duration: 400 });
      setTimeout(() => {
        const { x, y, zoom } = reactFlowInstance.getViewport();
        if (zoom < 0.5) {
          reactFlowInstance.setViewport({ x, y, zoom: 0.5 }, { duration: 200 });
        }
      }, 500);
    }, 50);
  }, [graphMode, notes, selectedNote?.id, handleRemoveFromCanvas, setNodes, setEdges, loadNotes, reactFlowInstance]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

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

      if (meta && e.key === "g") {
        e.preventDefault();
        toggleGraphView();
      }

      if (meta && e.key === "/") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }

      if (e.key === "Escape") {
        setSelectedNote(null);
        setShowImport(false);
        setShowShortcuts(false);
      }

      if ((e.key === "Backspace" || e.key === "Delete") && selectedNote) {
        const active = document.activeElement;
        if (active?.tagName === "INPUT" || active?.tagName === "TEXTAREA" || active?.closest(".tiptap")) return;
        handleRemoveFromCanvas(selectedNote.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [reactFlowInstance, canvasNoteIds, selectedNote, handleRemoveFromCanvas, loadNotes, toggleGraphView]);

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
    <div className="h-screen w-screen flex flex-col" style={{ background: "var(--bg)" }}>
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
          onNewNote={async () => {
            const { x, y, zoom } = reactFlowInstance.getViewport();
            const cx = (-x + window.innerWidth / 2) / zoom;
            const cy = (-y + window.innerHeight / 2) / zoom;
            const pos = findFreePosition(cx, cy, canvasNoteIds);
            const n = await createNote({ title: "Untitled" });
            await addToCanvas(n.id, pos.x, pos.y);
            setSelectedNote(n);
            loadNotes();
          }}
        />

        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onConnect={onConnect}
            onPaneClick={() => setSelectedNote(null)}
            onDoubleClick={onPaneDoubleClick}
            onNodeDragStop={onNodeDragStop}
            fitView
            minZoom={0.2}
            maxZoom={2}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{ type: "default" }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--canvas-dot)" gap={32} size={1} />
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
              onSelectNote={handleSelectNote}
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
              theme={theme}
              onSetTheme={handleSetTheme}
            />
          )}

          {/* Bottom-right controls */}
          <div className="absolute bottom-4 right-4 z-30 flex gap-2">
            <button
              onClick={toggleGraphView}
              className="h-7 px-3 rounded-full border text-xs font-mono flex items-center gap-1.5 transition-colors"
              style={{
                background: graphMode ? "var(--text)" : "var(--bg-secondary)",
                borderColor: graphMode ? "var(--text)" : "var(--border)",
                color: graphMode ? "var(--bg)" : "var(--text-muted)",
              }}
              title="Toggle graph view (Cmd+G)"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="2" cy="6" r="1.5" />
                <circle cx="6" cy="2" r="1.5" />
                <circle cx="10" cy="6" r="1.5" />
                <circle cx="6" cy="10" r="1.5" />
                <line x1="3.3" y1="5.2" x2="4.7" y2="3" />
                <line x1="7.3" y1="3" x2="8.7" y2="5.2" />
                <line x1="6" y1="3.5" x2="6" y2="8.5" />
              </svg>
              {graphMode ? "exit graph" : "graph"}
            </button>
            <button
              onClick={() => setShowShortcuts(true)}
              className="w-7 h-7 rounded-full border text-xs font-mono flex items-center justify-center transition-colors"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
              title="Keyboard shortcuts (Cmd+/)"
            >
              ?
            </button>
          </div>
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
