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
import {
  getAllNotes,
  createNote,
  getCanvasNotes,
  addToCanvas,
  removeFromCanvas,
  updateCanvasPosition,
  type Note,
} from "@/lib/db";
import { syncFromFolder } from "@/lib/sync";

const nodeTypes: NodeTypes = { noteNode: NoteNode };

const GraphCanvas = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [canvasNoteIds, setCanvasNoteIds] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, , onEdgesChange] = useEdgesState([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showImport, setShowImport] = useState(false);
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
      syncFromFolder()
        .catch(() => {})
        .finally(() => loadNotes());
    }
  }, [loadNotes]);

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
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const note = await createNote({ title: "Untitled" });
      await addToCanvas(note.id, position.x, position.y);

      setSelectedNote(note);
      loadNotes();
    },
    [reactFlowInstance, loadNotes]
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
        // Offset slightly so stacked adds don't overlap
        const offsetX = centerX + (Math.random() - 0.5) * 100;
        const offsetY = centerY + (Math.random() - 0.5) * 100;

        await addToCanvas(id, offsetX, offsetY);
        setCanvasNoteIds((prev) => {
          const next = new Map(prev);
          next.set(id, { x: offsetX, y: offsetY });
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
        onSync={loadNotes}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          notes={notes}
          selectedNoteId={selectedNote?.id ?? null}
          onSelectNote={handleSelectNote}
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
        </div>
      </div>
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
