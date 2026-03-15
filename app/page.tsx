"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
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
import { getAllNotes, createNote, updateNote, deleteNote, type Note } from "@/lib/db";
import { syncFromFolder } from "@/lib/sync";

const nodeTypes: NodeTypes = { noteNode: NoteNode };

const GraphCanvas = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, , onEdgesChange] = useEdgesState([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showImport, setShowImport] = useState(false);
  const reactFlowInstance = useReactFlow();
  const initialized = useRef(false);

  const handleDeleteNote = useCallback(
    async (id: string) => {
      await deleteNote(id);
      if (selectedNote?.id === id) setSelectedNote(null);
      const allNotes = await getAllNotes();
      setNotes(allNotes);
    },
    [selectedNote]
  );

  const loadNotes = useCallback(async () => {
    const allNotes = await getAllNotes();
    setNotes(allNotes);
  }, []);

  // Rebuild nodes whenever notes, selectedNote, or handleDeleteNote changes
  useEffect(() => {
    const newNodes: Node[] = notes.map((note, i) => ({
      id: note.id,
      type: "noteNode",
      position: {
        x: note.x ?? (i % 5) * 260,
        y: note.y ?? Math.floor(i / 5) * 120,
      },
      data: {
        title: note.title,
        summary: note.summary,
        isPrivate: note.isPrivate,
        selected: note.id === selectedNote?.id,
        noteId: note.id,
        onDelete: handleDeleteNote,
      } as NoteNodeData,
    }));
    setNodes(newNodes);
  }, [notes, selectedNote?.id, handleDeleteNote, setNodes]);

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

  const onPaneDoubleClick = useCallback(
    async (event: React.MouseEvent) => {
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const note = await createNote({
        title: "Untitled",
        x: position.x,
        y: position.y,
      });

      setSelectedNote(note);
      loadNotes();
    },
    [reactFlowInstance, loadNotes]
  );

  const onNodeDragStop = useCallback(
    async (_: React.MouseEvent, node: Node) => {
      await updateNote(node.id, { x: node.position.x, y: node.position.y });
    },
    []
  );

  const handleSelectNote = useCallback(
    (id: string) => {
      const note = notes.find((n) => n.id === id);
      if (note) {
        setSelectedNote(note);
        const node = nodes.find((n) => n.id === id);
        if (node) {
          reactFlowInstance.setCenter(node.position.x, node.position.y, {
            zoom: 1.2,
            duration: 500,
          });
        }
      }
    },
    [notes, nodes, reactFlowInstance]
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
