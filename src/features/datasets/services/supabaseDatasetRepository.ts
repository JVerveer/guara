import { getSupabaseClient, isSupabaseConfigured } from "@/data/supabase/client";
import type { GeographicLevel } from "@/data/geography/types";
import type { Database } from "@/data/supabase/types";
import type { Dataset, DatasetPreview, DatasetPreviewColumn, DatasetVariable } from "../types";

type DatasetCatalogRow = Database["public"]["Tables"]["dataset_catalog"]["Row"];
type DatasetDimensionRow = Database["public"]["Tables"]["dataset_dimensions"]["Row"];
type DatasetPreviewRow = Database["public"]["Tables"]["dataset_preview_rows"]["Row"];

const PREVIEW_ROW_LIMIT = 25;
const EMPTY_LEVEL_SUMMARY: Record<GeographicLevel, number> = {
  neighborhood: 0,
  municipality: 0,
  province: 0,
  country: 0,
  other: 0,
};
const DEFAULT_CBS_TAGS = ["Population", "Housing", "Economy"];

function queryYear(query: string): number | undefined {
  const trimmed = query.trim();
  if (!/^(?:19|20)\d{2}$/.test(trimmed)) return undefined;
  const year = Number(trimmed);
  return year >= 1970 && year <= 2026 ? year : undefined;
}

function rowToDataset(row: DatasetCatalogRow): Dataset {
  return {
    id: row.id,
    title: row.title,
    provider: row.provider,
    description: row.description ?? row.title,
    tags: row.provider === "CBS" ? DEFAULT_CBS_TAGS : [],
    updated: row.updated_at ? new Date(row.updated_at).toLocaleDateString("en-US", { dateStyle: "medium" }) : "Supabase",
    updatedAt: row.updated_at ?? undefined,
    records: row.record_count ? new Intl.NumberFormat("en-US", { notation: "compact" }).format(row.record_count) : "Supabase",
    recordCount: row.record_count ?? undefined,
    topics: 0,
    qualification: {
      yearStart: row.year_start ?? undefined,
      yearEnd: row.year_end ?? undefined,
      years: row.years,
      geographicLevels: row.geographic_levels as Dataset["qualification"]["geographicLevels"],
      spatialCoverage: row.spatial_coverage ?? undefined,
      periodSource: row.period_source as Dataset["qualification"]["periodSource"],
      confidence: row.qualification_confidence as Dataset["qualification"]["confidence"],
      evidence: row.qualification_evidence,
    },
  };
}

function normalizeCell(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function mapDimensionType(type: string): DatasetVariable["type"] {
  if (type.includes("Time") || type.includes("Geo") || type.includes("Dimension")) return "String";
  return "Float";
}

function dimensionToVariable(row: DatasetDimensionRow): DatasetVariable {
  return {
    name: row.key,
    title: row.title,
    type: mapDimensionType(row.type),
    descKey: row.title,
    role: row.type,
  };
}

function buildPreviewColumns(rows: DatasetPreviewRow[], dimensions: DatasetDimensionRow[]): DatasetPreviewColumn[] {
  const dimensionByKey = new Map(dimensions.map((dimension) => [dimension.key, dimension]));
  const keys = Array.from(
    rows.reduce<Set<string>>((acc, row) => {
      Object.keys(row.raw ?? {}).forEach((key) => {
        if (key !== "ID") acc.add(key);
      });
      return acc;
    }, new Set())
  ).slice(0, 12);

  if (keys.length === 0) {
    return dimensions.slice(0, 12).map((dimension) => ({
      key: dimension.key,
      title: dimension.title,
      type: dimension.type,
    }));
  }

  return keys.map((key) => {
    const dimension = dimensionByKey.get(key);
    return {
      key,
      title: dimension?.title ?? key,
      type: dimension?.type ?? "Measure",
    };
  });
}

function rowsToPreview(rows: DatasetPreviewRow[], columns: DatasetPreviewColumn[]): DatasetPreview["rows"] {
  return rows.map((previewRow) =>
    columns.reduce<Record<string, string | number | boolean | null>>((acc, column) => {
      acc[column.key] = normalizeCell(previewRow.raw?.[column.key]);
      return acc;
    }, {})
  );
}

export const supabaseDatasetRepository = {
  isConfigured: isSupabaseConfigured,

  async searchDatasets(query: string): Promise<Dataset[]> {
    const supabase = await getSupabaseClient();
    const trimmed = query.trim();
    const year = queryYear(trimmed);
    let request = supabase
      .from("dataset_catalog")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (year) {
      request = request.contains("years", [year]);
    } else if (trimmed) {
      request = request.or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%,id.ilike.%${trimmed}%`);
    }

    const { data, error } = await request;
    if (error) throw error;
    return (data ?? []).map(rowToDataset);
  },

  async getDatasetById(id: string): Promise<Dataset | undefined> {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("dataset_catalog")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? rowToDataset(data) : undefined;
  },

  async getDatasetDimensions(datasetId: string): Promise<DatasetDimensionRow[]> {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("dataset_dimensions")
      .select("*")
      .eq("dataset_id", datasetId)
      .order("key", { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  async getDetailVariables(datasetId: string): Promise<DatasetVariable[]> {
    const dimensions = await this.getDatasetDimensions(datasetId);
    return dimensions.map(dimensionToVariable);
  },

  async getDetailPreview(datasetId: string): Promise<DatasetPreview> {
    const [dataset, dimensions] = await Promise.all([
      this.getDatasetById(datasetId),
      this.getDatasetDimensions(datasetId),
    ]);

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from("dataset_preview_rows")
      .select("*")
      .eq("dataset_id", datasetId)
      .order("row_index", { ascending: true })
      .limit(PREVIEW_ROW_LIMIT);

    if (error) {
      return {
        columns: buildPreviewColumns([], dimensions),
        rows: [],
        geographySummary: EMPTY_LEVEL_SUMMARY,
        totalRecordCount: dataset?.recordCount ?? 0,
      };
    }

    const rows = data ?? [];
    const columns = buildPreviewColumns(rows, dimensions);

    return {
      columns,
      rows: rowsToPreview(rows, columns),
      geographySummary: EMPTY_LEVEL_SUMMARY,
      totalRecordCount: dataset?.recordCount ?? rows.length,
    };
  },

  async upsertDatasets(datasets: Dataset[]): Promise<void> {
    const supabase = await getSupabaseClient();
    const rows: Database["public"]["Tables"]["dataset_catalog"]["Insert"][] = datasets.map((dataset) => ({
      id: dataset.id,
      provider: dataset.provider,
      title: dataset.title,
      description: dataset.description,
      updated_at: dataset.updatedAt,
      record_count: dataset.recordCount,
      year_start: dataset.qualification.yearStart,
      year_end: dataset.qualification.yearEnd,
      years: dataset.qualification.years,
      geographic_levels: dataset.qualification.geographicLevels,
      spatial_coverage: dataset.qualification.spatialCoverage,
      period_source: dataset.qualification.periodSource,
      qualification_confidence: dataset.qualification.confidence,
      qualification_evidence: dataset.qualification.evidence,
      source_url: `https://opendata.cbs.nl/ODataApi/odata/${dataset.id}`,
    }));

    const { error } = await supabase.from("dataset_catalog").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  },
};
