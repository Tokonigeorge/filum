"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  useReactFlow,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "@dagrejs/dagre";

import NoteNode, { type NoteNodeData } from "@/components/NoteNode";
import EditorPanel from "@/components/EditorPanel";
import ImportPanel from "@/components/ImportPanel";
import TopBar from "@/components/TopBar";
import { getAllNotes, createNote, updateNote, type Note } from "@/lib/db";
import { cosineSimilarity, SIMILARITY_THRESHOLD } from "@/lib/similarity";

const nodeTypes: NodeTypes = { noteNode: NoteNode };

const layoutNodes = (nodes: Node[], edges: Edge[]): Node[] => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 100 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 220, height: 80 });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: node.data._hasPosition ? node.position.x : pos.x - 110,
        y: node.data._hasPosition ? node.position.y : pos.y - 40,
      },
    };
  });
};

const buildGraph = (notes: Note[], selectedId: string | null) => {
  const nodes: Node[] = notes.map((note, i) => ({
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
      selected: note.id === selectedId,
    } as NoteNodeData,
  }));

  return { nodes, edges: [] as Edge[] };
};

const GraphCanvas = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showImport, setShowImport] = useState(false);
  const reactFlowInstance = useReactFlow();
  const initialized = useRef(false);

  const loadNotes = useCallback(async () => {
    const allNotes = await getAllNotes();
    setNotes(allNotes);
    const { nodes: n, edges: e } = buildGraph(
      allNotes,
      selectedNote?.id ?? null
    );
    setNodes(n);
    setEdges(e);
  }, [selectedNote?.id, setNodes, setEdges]);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      loadNotes();
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
          <Controls
            className="!bg-neutral-900 !border-neutral-800 !shadow-none [&>button]:!bg-neutral-900 [&>button]:!border-neutral-800 [&>button]:!text-neutral-400 [&>button:hover]:!bg-neutral-800"
          />
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
  );
}

const Home = () => {
  return (
    <ReactFlowProvider>
      <GraphCanvas />
    </ReactFlowProvider>
  );
};

export default Home;
