/** Copyright 2026 Google LLC — Apache-2.0 */

import type { WorkflowCanvasEdge, WorkflowCanvasNode } from "../graph-types";

export interface AutoLayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  horizontalSpacing?: number;
  verticalSpacing?: number;
  startX?: number;
  startY?: number;
}

/** Compute clean, non-overlapping horizontal rank positions for workflow nodes on the canvas. */
export function applyAutoLayout(
  nodes: WorkflowCanvasNode[],
  edges: WorkflowCanvasEdge[],
  options: AutoLayoutOptions = {},
): WorkflowCanvasNode[] {
  if (nodes.length === 0) return [];

  const nodeWidth = options.nodeWidth ?? 264;
  const horizontalSpacing = options.horizontalSpacing ?? 100;
  const verticalSpacing = options.verticalSpacing ?? 40;
  const startX = options.startX ?? 80;
  const startY = options.startY ?? 120;

  const nodeMap = new Map<string, WorkflowCanvasNode>(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  nodes.forEach((n) => {
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  });

  edges.forEach((edge) => {
    if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
      adjacency.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
  });

  // Calculate topological rank / column for each node
  const ranks = new Map<string, number>();
  nodes.forEach((n) => {
    if ((inDegree.get(n.id) ?? 0) === 0) {
      ranks.set(n.id, 0);
    }
  });

  // BFS / Longest-path ranking
  let changed = true;
  let maxPasses = nodes.length * 2;
  while (changed && maxPasses > 0) {
    changed = false;
    maxPasses--;
    edges.forEach((edge) => {
      const srcRank = ranks.get(edge.source);
      if (srcRank !== undefined) {
        const targetRank = ranks.get(edge.target) ?? 0;
        const newRank = Math.max(targetRank, srcRank + 1);
        if (newRank !== targetRank) {
          ranks.set(edge.target, newRank);
          changed = true;
        }
      }
    });
  }

  // Ensure all unvisited nodes get assigned a rank
  nodes.forEach((n) => {
    if (!ranks.has(n.id)) ranks.set(n.id, 0);
  });

  // Group nodes by rank
  const rankGroups = new Map<number, WorkflowCanvasNode[]>();
  nodes.forEach((n) => {
    const rank = ranks.get(n.id) ?? 0;
    if (!rankGroups.has(rank)) rankGroups.set(rank, []);
    rankGroups.get(rank)?.push(n);
  });

  // Calculate positions per rank column
  const columnWidth = nodeWidth + horizontalSpacing;

  return nodes.map((node) => {
    const rank = ranks.get(node.id) ?? 0;
    const group = rankGroups.get(rank) ?? [node];
    const indexInGroup = group.findIndex((n) => n.id === node.id);

    const x = startX + rank * columnWidth;
    const y = startY + indexInGroup * (180 + verticalSpacing);

    return {
      ...node,
      position: { x, y },
    };
  });
}
