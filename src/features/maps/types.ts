import type { GeographicLevel } from "@/data/geography/types";

interface GeoJsonPolygonGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

export type GeometryLike =
  | {
      type: "svg-path";
      path: string;
    }
  | {
      type: "geojson";
      geometry: GeoJsonPolygonGeometry;
    };

export interface Source {
  provider: string;
  lastUpdated: string;
  confidence: number;
}

export interface Statistic {
  datasetId: string;
  indicator: string;
  year: number;
  value: number;
  unit: string;
  source: Source;
}

export interface Municipality {
  id: string;
  cbsCode: string;
  name: string;
  province: string;
  level: "municipality";
  geometry: GeometryLike;
  centroid: [number, number];
  disabled?: boolean;
}

export interface MunicipalityMetadata {
  population: number;
  medianAge: number;
  income: number;
  housePrice: number;
  dataAvailable: number;
  relatedDatasets: string[];
  evidence: string[];
  recentResearch: string[];
  suggestedQuestions: string[];
}

export interface DatasetValue {
  municipalityId: string;
  geographicLevel: GeographicLevel;
  datasetId: string;
  indicator: string;
  year: number;
  value: number;
  unit: string;
  source: Source;
}

export type VisualizationMode =
  | "sequential"
  | "diverging"
  | "categorical"
  | "heatmap"
  | "quantiles";

export interface LegendItem {
  label: string;
  color: string;
}

export interface Legend {
  title: string;
  mode: VisualizationMode;
  items: LegendItem[];
}

export interface ActiveFilters {
  datasetId: string;
  year: number;
  indicator: string;
  compareMode: boolean;
  query: string;
}
