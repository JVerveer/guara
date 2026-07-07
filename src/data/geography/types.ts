export type GeographicLevel = "municipality" | "province" | "country" | "other";

export interface GeographicQualification {
  level: GeographicLevel;
  label: string;
  code?: string;
  name?: string;
  sourceField?: string;
}
