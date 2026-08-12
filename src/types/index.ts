// Shared cross-cutting types only.
// Feature-specific types live in src/features/<feature>/types.ts

export type Screen =
  | "home"
  | "planning"
  | "workspace"
  | "result"
  | "datasets"
  | "sources"
  | "semantic-workbench"
  | "dataset-detail";
