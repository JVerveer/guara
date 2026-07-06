import { useState } from "react";
import { graphTokens } from "@/theme/tokens";
import { useTheme } from "@/app/providers/ThemeProvider";
import type { ConceptEdge, MiniNode, MiniResearchGraph } from "../types";

const NODE_RADIUS = 18;

function findNode(nodes: MiniNode[], id: string): MiniNode | undefined {
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

interface MiniGraphProps {
  graph: MiniResearchGraph;
}

export function MiniGraph({ graph }: MiniGraphProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const { isDark } = useTheme();
  const g = isDark ? graphTokens.dark : graphTokens.light;
  const { nodes, edges } = graph;
  const conn = hovered ? buildConnected(hovered, edges) : null;

  return (
    <svg
      viewBox="0 0 320 215"
      className="w-full h-full"
      role="img"
      aria-label="Mini research graph"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
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
            style={{ transition: "stroke 0.15s" }}
          />
        );
      })}

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
            tabIndex={0}
            role="button"
            aria-label={node.label}
            aria-pressed={isHovered}
            style={{ cursor: "pointer", outline: "none" }}
          >
            <circle
              r={NODE_RADIUS}
              fill={active ? g.nodeActiveFill : g.nodeFill}
              stroke={active ? g.nodeActiveStroke : g.nodeStroke}
              strokeWidth={1.5}
              aria-hidden="true"
              style={{
                transition: "fill 0.15s, stroke 0.15s",
                opacity: dimmed ? 0.2 : 1,
                filter: isHovered ? g.nodeHoverShadow : "none",
              }}
            />
            <text
              textAnchor="middle"
              dy="4px"
              fontSize="9"
              fontWeight="500"
              fill={active ? g.labelActiveColor : g.labelColor}
              aria-hidden="true"
              style={{ transition: "fill 0.15s", opacity: dimmed ? 0.2 : 1, userSelect: "none" }}
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
