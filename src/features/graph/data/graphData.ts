import type { ConceptEdge, MiniNode, ResearchGraph, SemanticConcept } from "../types";

// ── Main knowledge graph ──────────────────────────────────────────────────────

const mainNodes: SemanticConcept[] = [
  { id: "population", label: "Population", x: 500, y: 310, datasets: 124 },
  { id: "housing", label: "Housing", x: 330, y: 165, datasets: 87 },
  { id: "income", label: "Income", x: 665, y: 140, datasets: 64 },
  { id: "inflation", label: "Inflation", x: 820, y: 275, datasets: 48 },
  { id: "energy", label: "Energy", x: 755, y: 460, datasets: 56 },
  { id: "education", label: "Education", x: 525, y: 545, datasets: 72 },
  { id: "migration", label: "Migration", x: 285, y: 490, datasets: 43 },
  { id: "crime", label: "Crime", x: 175, y: 295, datasets: 38 },
  { id: "healthcare", label: "Healthcare", x: 230, y: 148, datasets: 91 },
];

const mainEdges: ConceptEdge[] = [
  { source: "population", target: "housing" },
  { source: "population", target: "income" },
  { source: "population", target: "migration" },
  { source: "population", target: "education" },
  { source: "population", target: "healthcare" },
  { source: "population", target: "crime" },
  { source: "housing", target: "income" },
  { source: "housing", target: "migration" },
  { source: "income", target: "inflation" },
  { source: "income", target: "education" },
  { source: "inflation", target: "energy" },
  { source: "energy", target: "education" },
  { source: "healthcare", target: "crime" },
  { source: "migration", target: "education" },
  { source: "migration", target: "crime" },
];

export const mainGraph: ResearchGraph = { nodes: mainNodes, edges: mainEdges };

// ── Mini graph (research sidebar) ────────────────────────────────────────────

const miniNodes: MiniNode[] = [
  { id: "housing", label: "Housing", x: 70, y: 52 },
  { id: "population", label: "Population", x: 158, y: 96 },
  { id: "inflation", label: "Inflation", x: 236, y: 50 },
  { id: "migration", label: "Migration", x: 210, y: 155 },
  { id: "municipality", label: "Municip.", x: 82, y: 155 },
  { id: "prices", label: "H. Prices", x: 248, y: 118 },
];

const miniEdges: ConceptEdge[] = [
  { source: "housing", target: "population" },
  { source: "housing", target: "municipality" },
  { source: "housing", target: "prices" },
  { source: "population", target: "inflation" },
  { source: "population", target: "migration" },
  { source: "population", target: "municipality" },
  { source: "inflation", target: "prices" },
  { source: "migration", target: "prices" },
];

export const miniGraphData = { nodes: miniNodes, edges: miniEdges };
