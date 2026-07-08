import type { GeographicLevel } from "@/data/geography/types";

export interface Dataset {
  id: string;
  title: string;
  provider: string;
  description: string;
  tags: string[];
  updated: string;
  updatedAt?: string;
  records: string;
  recordCount?: number;
  topics: number;
  qualification: DatasetQualification;
  source?: DatasetSourceMetadata;
}

export interface DatasetSourceMetadata {
  layer: "bronze" | "silver" | "public";
  originalProvider: string;
  sourceUrl?: string;
  catalog?: string;
  language?: string;
  sourceVersion?: string;
  cbsUpdatedAt?: string;
  bronzeIngestedAt?: string;
  silverLoadedAt?: string;
  loadStatus?: string;
  observationsLoaded?: number;
  dimensionsLoaded?: number;
  measuresLoaded?: number;
  rejectedRows?: number;
}

export interface DatasetQualification {
  yearStart?: number;
  yearEnd?: number;
  years: number[];
  geographicLevels: GeographicLevel[];
  spatialCoverage?: string;
  periodSource?: "perioden-dimension" | "catalog-period" | "catalog-text" | "none";
  confidence: "cbs-metadata" | "partial-metadata" | "unqualified";
  evidence: string[];
}

export interface DatasetVariable {
  name: string;
  type: "Integer" | "Float" | "String" | "Boolean" | "Date";
  descKey: string;
  title?: string;
  unit?: string;
  role?: string;
}

export interface DatasetPreviewColumn {
  key: string;
  title: string;
  type: string;
  unit?: string;
}

export interface DatasetPreview {
  columns: DatasetPreviewColumn[];
  rows: Array<Record<string, string | number | boolean | null>>;
  geographySummary: Record<GeographicLevel, number>;
  totalRecordCount: number;
}

export interface SuggestedJoin {
  name: string;
  provider: string;
  join: string;
}
