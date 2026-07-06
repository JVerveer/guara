// Shared cross-cutting types only.
// Feature-specific types live in src/features/<feature>/types.ts

export type Screen =
  | "home"
  | "result"
  | "datasets"
  | "sources"
  | "map"
  | "graph"
  | "dataset-detail";
