import { getSupabaseClient, isSupabaseConfigured } from "@/data/supabase/client";
import type { Database } from "@/data/supabase/types";
import type { Dataset } from "../types";

type DatasetCatalogRow = Database["public"]["Tables"]["dataset_catalog"]["Row"];

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
    tags: [],
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
      .limit(50);

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
