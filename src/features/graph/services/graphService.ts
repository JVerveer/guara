/**
 * Graph service — API contract for the knowledge graph.
 *
 * All methods return Promises. Replace mock implementations with real API
 * calls when the backend is available.
 *
 * API integration points are marked with TODO comments.
 */

import { mainGraph, miniGraphData } from "../data/graphData";
import type { MiniResearchGraph, ResearchGraph } from "../types";

export const graphService = {
  /**
   * Returns the full knowledge graph for the graph explorer screen.
   *
   * TODO: Replace with real API call:
   * ```
   * return apiClient.get<ResearchGraph>('/graph');
   * ```
   */
  async getMainGraph(): Promise<ResearchGraph> {
    return Promise.resolve(mainGraph);
  },

  /**
   * Returns the compact graph shown in the research result sidebar.
   *
   * TODO: Replace with real API call:
   * ```
   * return apiClient.get<MiniResearchGraph>('/graph/mini');
   * ```
   */
  async getMiniGraph(): Promise<MiniResearchGraph> {
    return Promise.resolve(miniGraphData);
  },

  // Synchronous helpers computed from static data — replace with API aggregates
  getTotalDatasets(): number {
    return mainGraph.nodes.reduce((sum, n) => sum + (n.datasets ?? 0), 0);
  },

  getNodeCount(): number {
    return mainGraph.nodes.length;
  },

  getEdgeCount(): number {
    return mainGraph.edges.length;
  },
};
