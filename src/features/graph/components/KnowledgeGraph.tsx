import { useState } from "react";
import { graphTokens } from "@/theme/tokens";
import { useTheme } from "@/app/providers/ThemeProvider";
import type { ConceptEdge, ResearchGraph, SemanticConcept } from "../types";

const NODE_RADIUS = 34;

function findNode(nodes: SemanticConcept[], id: string): SemanticConcept | undefined {
  return nodes.find((n) => n.id === id);
}

function buildConnected(nodeId: string, edges: ConceptEdge[]): Set<string> {
  const set = new Set([nodeId]);
  for (const e of edges) {
    if (e.source === nodeId) set.add(e.target);
    if (e.target === nodeId) set.add(e.source);
  }
  return set;
}

interface KnowledgeGraphProps {
  graph: ResearchGraph;
}

export function KnowledgeGraph({ graph }: KnowledgeGraphProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const { isDark } = useTheme();
  const g = isDark ? graphTokens.dark : graphTokens.light;
  const { nodes, edges } = graph;
  const conn = hovered ? buildConnected(hovered, edges) : null;

  return (
    <svg
      viewBox="0 0 1000 640"
      className="w-full h-full"
      role="img"
      aria-label="Knowledge graph showing semantic concept relationships"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <defs>
        <pattern id="guaraGrid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke={g.gridStroke} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1000" height="640" fill="url(#guaraGrid)" />

      {/* Edges */}
      {edges.map((edge, i) => {
        const s = findNode(nodes, edge.source);
        const t = findNode(nodes, edge.target);
        if (!s || !t) return null;
        const active = !conn || (conn.has(edge.source) && conn.has(edge.target));
        return (
          <line
            key={i}
            x1={s.x} y1={s.y}
            x2={t.x} y2={t.y}
            stroke={active ? g.edgeActive : g.edgeDim}
            strokeWidth={active ? 1.5 : 1}
            aria-hidden="true"
            style={{ transition: "stroke 0.2s, stroke-width 0.2s" }}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const isHovered = hovered === node.id;
        const isConnected = conn ? conn.has(node.id) : false;
        const active = isHovered || isConnected;
        const dimmed = conn && !isConnected;

        return (
          <g
            key={node.id}
            transform={`translate(${node.x},${node.y})`}
            onMouseEnter={() => setHovered(node.id)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(node.id)}
            onBlur={() => setHovered(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setHovered(node.id);
              if (e.key === "Escape") setHovered(null);
            }}
            tabIndex={0}
            role="button"
            aria-label={`${node.label}${node.datasets ? `, ${node.datasets} datasets` : ""}`}
            aria-pressed={isHovered}
            style={{ cursor: "pointer", outline: "none" }}
          >
            {isHovered && (
              <circle r={NODE_RADIUS + 10} fill="none" stroke={g.nodeHoverRing} strokeWidth="1" aria-hidden="true" />
            )}
            <circle
              r={NODE_RADIUS}
              fill={active ? g.nodeActiveFill : g.nodeFill}
              stroke={active ? g.nodeActiveStroke : g.nodeStroke}
              strokeWidth={1.5}
              aria-hidden="true"
              style={{
                transition: "fill 0.18s, stroke 0.18s",
                opacity: dimmed ? 0.18 : 1,
                filter: isHovered ? g.nodeHoverShadow : "none",
              }}
            />
            <text
              textAnchor="middle"
              dy="-3px"
              fontSize="12.5"
              fontWeight="500"
              fill={active ? g.labelActiveColor : g.labelColor}
              aria-hidden="true"
              style={{ transition: "fill 0.18s", opacity: dimmed ? 0.18 : 1, userSelect: "none" }}
            >
              {node.label}
            </text>
            {node.datasets !== undefined && (
              <text
                textAnchor="middle"
                dy="13px"
                fontSize="9.5"
                fill={active ? g.subLabelActiveColor : g.subLabelColor}
                aria-hidden="true"
                style={{ transition: "fill 0.18s", opacity: dimmed ? 0.18 : 1, userSelect: "none" }}
              >
                {node.datasets} datasets
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
