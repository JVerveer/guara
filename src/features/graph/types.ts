/**
 * Domain types for the Research Graph feature.
 *
 * A SemanticConcept is a high-level knowledge node in the research graph
 * (e.g. "Housing", "Population", "Inflation"). Concepts are linked to
 * datasets and to each other via ConceptEdges.
 *
 * ResearchGraph is the top-level structure returned by the graph service.
 */

export interface SemanticConcept {
  id: string;
  /** Human-readable label, e.g. "Housing" */
  label: string;
  /** SVG canvas X coordinate */
  x: number;
  /** SVG canvas Y coordinate */
  y: number;
  /** Number of datasets linked to this concept */
  datasets?: number;
}

export interface ConceptEdge {
  source: string;
  target: string;
}

/** Full knowledge graph returned by the graph service */
export interface ResearchGraph {
  nodes: SemanticConcept[];
  edges: ConceptEdge[];
}

/** Compact graph used in the research result sidebar */
export interface MiniResearchGraph {
  nodes: MiniNode[];
  edges: ConceptEdge[];
}

export interface MiniNode {
  id: string;
  label: string;
  x: number;
  y: number;
}
