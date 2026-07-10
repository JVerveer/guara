import { getSupabaseClient, isSupabaseConfigured } from "@/data/supabase/client";
import type { GeographicLevel } from "@/data/geography/types";
import type { Database } from "@/data/supabase/types";
import type { Dataset, DatasetPreview, DatasetPreviewColumn, DatasetVariable } from "../types";

type DatasetCatalogRow = Database["public"]["Tables"]["dataset_catalog"]["Row"];
type DatasetDimensionRow = Database["public"]["Tables"]["dataset_dimensions"]["Row"];
type DatasetPreviewRow = Database["public"]["Tables"]["dataset_preview_rows"]["Row"];
type SilverDatasetCatalogRow = Database["public"]["Tables"]["silver_dataset_catalog"]["Row"];

const PREVIEW_ROW_LIMIT = 25;
const EMPTY_LEVEL_SUMMARY: Record<GeographicLevel, number> = {
  neighborhood: 0,
  municipality: 0,
  province: 0,
  country: 0,
  other: 0,
};
const DEFAULT_CBS_TAGS = ["Population", "Housing", "Economy"];
const SILVER_TAGS = ["Silver", ...DEFAULT_CBS_TAGS];

function queryYear(query: string): number | undefined {
  const trimmed = query.trim();
  if (!/^(?:19|20)\d{2}$/.test(trimmed)) return undefined;
  const year = Number(trimmed);
  return year >= 1970 && year <= 2026 ? year : undefined;
}

function catalogQualification(row: DatasetCatalogRow | undefined): Dataset["qualification"] {
  return {
    yearStart: row?.year_start ?? undefined,
    yearEnd: row?.year_end ?? undefined,
    years: row?.years ?? [],
    geographicLevels: (row?.geographic_levels ?? []) as Dataset["qualification"]["geographicLevels"],
    spatialCoverage: row?.spatial_coverage ?? undefined,
    periodSource: row?.period_source as Dataset["qualification"]["periodSource"],
    confidence: (row?.qualification_confidence ?? "unqualified") as Dataset["qualification"]["confidence"],
    evidence: row?.qualification_evidence ?? [],
  };
}

function silverRowToDataset(row: SilverDatasetCatalogRow, catalog?: DatasetCatalogRow): Dataset {
  const recordCount = catalog?.record_count ?? row.observations_loaded ?? undefined;
  const updatedAt = row.silver_loaded_at ?? row.cbs_updated_at ?? catalog?.updated_at ?? undefined;

  return {
    id: row.dataset_id,
    title: row.short_title || row.title,
    provider: row.provider,
    description: row.description ?? catalog?.description ?? row.title,
    tags: row.provider === "CBS" ? SILVER_TAGS : ["Silver"],
    updated: updatedAt ? new Date(updatedAt).toLocaleDateString("en-US", { dateStyle: "medium" }) : "Silver",
    updatedAt,
    records: recordCount ? new Intl.NumberFormat("en-US", { notation: "compact" }).format(recordCount) : "Silver",
    recordCount,
    topics: row.measures_loaded ?? 0,
    qualification: catalogQualification(catalog),
    source: {
      layer: "silver",
      originalProvider: row.provider,
      sourceUrl: row.source_url ?? catalog?.source_url ?? undefined,
      catalog: row.catalog ?? undefined,
      language: row.language ?? undefined,
      sourceVersion: row.source_version ?? undefined,
      cbsUpdatedAt: row.cbs_updated_at ?? undefined,
      bronzeIngestedAt: row.bronze_ingested_at ?? undefined,
      silverLoadedAt: row.silver_loaded_at ?? undefined,
      loadStatus: row.load_status ?? undefined,
      observationsLoaded: row.observations_loaded ?? undefined,
      dimensionsLoaded: row.dimensions_loaded ?? undefined,
      measuresLoaded: row.measures_loaded ?? undefined,
      rejectedRows: row.rejected_rows ?? undefined,
    },
  };
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "PGRST205" || Boolean(error?.message?.includes("Could not find the table"));
}

function matchesSilverSearch(row: SilverDatasetCatalogRow, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  return [
    row.dataset_id,
    row.title,
    row.short_title,
    row.description,
    row.catalog,
    row.period,
    row.load_status,
  ].some((value) => String(value ?? "").toLowerCase().includes(trimmed));
}

function coversYear(catalog: DatasetCatalogRow | undefined, year: number | undefined): boolean {
  if (!year) return true;
  if (!catalog) return false;
  if (catalog.years.length > 0) return catalog.years.includes(year);
  if (catalog.year_start === null || catalog.year_end === null) return false;
  return catalog.year_start <= year && catalog.year_end >= year;
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
    return this.searchSilverDatasets(query);
  },

  async searchSilverDatasets(query: string): Promise<Dataset[]> {
    const supabase = await getSupabaseClient();
    const year = queryYear(query);
    const { data, error } = await supabase
      .from("silver_dataset_catalog")
      .select("*")
      .order("silver_loaded_at", { ascending: false })
      .limit(200);

    if (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }

    const silverRows = (data ?? []).filter((row) => matchesSilverSearch(row, year ? "" : query));
    if (silverRows.length === 0) return [];
    const ids = silverRows.map((row) => row.dataset_id);
    if (ids.length === 0) return [];

    const { data: catalogRows, error: catalogError } = await supabase
      .from("dataset_catalog")
      .select("*")
      .in("id", ids);

    if (catalogError) throw catalogError;

    const catalogById = new Map((catalogRows ?? []).map((row) => [row.id, row]));
    return silverRows
      .filter((row) => coversYear(catalogById.get(row.dataset_id), year))
      .map((row) => silverRowToDataset(row, catalogById.get(row.dataset_id)));
  },

  async getDatasetById(id: string): Promise<Dataset | undefined> {
    const supabase = await getSupabaseClient();
    const { data: silverData, error: silverError } = await supabase
      .from("silver_dataset_catalog")
      .select("*")
      .eq("dataset_id", id)
      .maybeSingle();

    if (silverError && !isMissingTableError(silverError)) throw silverError;

    const { data, error } = await supabase
      .from("dataset_catalog")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return silverData ? silverRowToDataset(silverData, data ?? undefined) : undefined;
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
      source_url: dataset.source?.sourceUrl,
    }));

    const { error } = await supabase.from("dataset_catalog").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  },
};
