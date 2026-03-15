/**
 * Force-directed graph layout using d3-force.
 *
 * Takes all notes and their links, returns positions where
 * connected notes cluster together and unrelated ones spread apart.
 */

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";

interface GraphNode extends SimulationNodeDatum {
  id: string;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string;
  target: string;
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
}

export const computeForceLayout = (
  noteIds: string[],
  links: { sourceId: string; targetId: string }[]
): LayoutResult => {
  const nodes: GraphNode[] = noteIds.map((id) => ({ id }));

  const graphLinks: GraphLink[] = links
    .filter((l) => noteIds.includes(l.sourceId) && noteIds.includes(l.targetId))
    .map((l) => ({ source: l.sourceId, target: l.targetId }));

  const simulation = forceSimulation(nodes)
    .force(
      "link",
      forceLink<GraphNode, GraphLink>(graphLinks)
        .id((d) => d.id)
        .distance(200)
        .strength(0.8)
    )
    .force("charge", forceManyBody().strength(-400))
    .force("center", forceCenter(0, 0))
    .force("collide", forceCollide(160))
    .stop();

  // Run the simulation synchronously
  for (let i = 0; i < 300; i++) {
    simulation.tick();
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
  }

  return { positions };
};
