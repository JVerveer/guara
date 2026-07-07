export type GeographicLevel = "municipality" | "province" | "country" | "other";

export interface GeographicQualification {
  level: GeographicLevel;
  label: string;
  code?: string;
  name?: string;
  sourceField?: string;
  source: "cbs-dimension" | "cbs-row-field" | "code-fallback" | "none";
  evidence?: string;
}
