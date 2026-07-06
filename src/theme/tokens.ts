// Single source of truth for all design tokens used outside of Tailwind/CSS variables.
// Use Tailwind token classes (bg-background, text-foreground, etc.) wherever possible.
// This file covers: provider brand colors, chart palette, graph colors, font stacks,
// and semantic helpers that must be computed at runtime (e.g. confidence thresholds).

// ── Font families ────────────────────────────────────────────────────────────
export const fonts = {
  display: "'Instrument Serif', serif",
  body: "'Inter', sans-serif",
  mono: "'DM Mono', monospace",
} as const;

// ── Provider brand colors ────────────────────────────────────────────────────
// These are official brand/identity colors — they do not change with theme.
// Each entry has a fill and a text color for the badge pill.
export const providerColors: Record<string, { fill: string; text: string }> = {
  CBS: { fill: "#1C3D8F", text: "#FFFFFF" },
  KNMI: { fill: "#0369A1", text: "#FFFFFF" },
  Kadaster: { fill: "#1D4E1A", text: "#FFFFFF" },
  Eurostat: { fill: "#003399", text: "#FFFFFF" },
  "World Bank": { fill: "#006548", text: "#FFFFFF" },
  OECD: { fill: "#1F3A6E", text: "#FFFFFF" },
  RDW: { fill: "#92400E", text: "#FFFFFF" },
  RIVM: { fill: "#1E5B8C", text: "#FFFFFF" },
  Parliament: { fill: "#3B2F7A", text: "#FFFFFF" },
  "Municipal Data": { fill: "#5B4700", text: "#FFFFFF" },
};

export function getProviderColor(name: string): { fill: string; text: string } {
  return providerColors[name] ?? { fill: "#374151", text: "#FFFFFF" };
}

// ── Chart palette ────────────────────────────────────────────────────────────
export const chartColors = {
  amsterdam: "#1C3D8F",
  utrecht: "#3B82F6",
  rotterdam: "#06B6D4",
  barFill: "#1C3D8F",
} as const;

// ── Confidence bar colors ────────────────────────────────────────────────────
export function confidenceColor(value: number): string {
  if (value >= 90) return "#16A34A";
  if (value >= 75) return "#D97706";
  return "#DC2626";
}

// ── Knowledge graph colors (theme-aware) ─────────────────────────────────────
export const graphTokens = {
  light: {
    nodeFill: "#FFFFFF",
    nodeStroke: "#CBD5E1",
    nodeActiveFill: "#1C3D8F",
    nodeActiveStroke: "#1C3D8F",
    nodeHoverRing: "rgba(28,61,143,0.18)",
    edgeActive: "#94A3B8",
    edgeDim: "#E8ECEF",
    labelColor: "#374151",
    labelActiveColor: "#FFFFFF",
    subLabelColor: "#9CA3AF",
    subLabelActiveColor: "rgba(255,255,255,0.65)",
    gridStroke: "rgba(0,0,0,0.04)",
    nodeHoverShadow: "drop-shadow(0 4px 14px rgba(28,61,143,0.38))",
  },
  dark: {
    nodeFill: "#21262D",
    nodeStroke: "#30363D",
    nodeActiveFill: "#4B7BEC",
    nodeActiveStroke: "#4B7BEC",
    nodeHoverRing: "rgba(75,123,236,0.22)",
    edgeActive: "#4B5563",
    edgeDim: "#21262D",
    labelColor: "#E2E8F0",
    labelActiveColor: "#FFFFFF",
    subLabelColor: "#6B7280",
    subLabelActiveColor: "rgba(255,255,255,0.65)",
    gridStroke: "rgba(255,255,255,0.03)",
    nodeHoverShadow: "drop-shadow(0 4px 14px rgba(75,123,236,0.45))",
  },
} as const;

export type GraphTheme = typeof graphTokens.light;
