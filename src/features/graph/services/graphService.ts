/**
 * Graph service — API contract for the knowledge graph.
 *
 */

import type { MiniResearchGraph, ResearchGraph } from "../types";

export const graphService = {
  async getMainGraph(): Promise<ResearchGraph> {
    return Promise.resolve({ nodes: [], edges: [] });
  },

  async getMiniGraph(): Promise<MiniResearchGraph | null> {
    return Promise.resolve(null);
  },

  getTotalDatasets(): number {
    return 0;
  },

  getNodeCount(): number {
    return 0;
  },

  getEdgeCount(): number {
    return 0;
  },
};
