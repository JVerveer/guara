import { getSupabaseClient, isSupabaseConfigured } from "@/data/supabase/client";
import type { Database } from "@/data/supabase/types";
import type { Connector } from "../types";

type SilverCatalogRow = Database["public"]["Tables"]["silver_dataset_catalog"]["Row"];

let cachedConnectors: Connector[] | null = null;

function formatDate(value?: string | null): string {
  if (!value) return "Not synced";
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function completeness(loaded: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((loaded / total) * 100);
}

async function countPublicTable(table: "dataset_catalog" | "dataset_preview_rows" | "silver_dataset_catalog"): Promise<number> {
  const supabase = await getSupabaseClient();
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

async function getSilverRows(): Promise<SilverCatalogRow[]> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("silver_dataset_catalog")
    .select("*")
    .order("silver_loaded_at", { ascending: false })
    .limit(1000);

  if (error) throw error;
  return data ?? [];
}

async function getLayerConnectors(): Promise<Connector[]> {
  if (!isSupabaseConfigured()) return [];

  const [bronzeDatasets, previewRows, silverRows] = await Promise.all([
    countPublicTable("dataset_catalog"),
    countPublicTable("dataset_preview_rows").catch(() => 0),
    getSilverRows().catch(() => []),
  ]);
  const completedSilver = silverRows.filter((row) => row.load_status === "completed" || row.load_status === "completed_with_rejections").length;
  const rejectedSilverRows = silverRows.reduce((sum, row) => sum + (row.rejected_rows ?? 0), 0);
  const silverObservations = silverRows.reduce((sum, row) => sum + (row.observations_loaded ?? 0), 0);
  const lastBronzeSync = await getSupabaseClient()
    .then((supabase) =>
      supabase
        .from("dataset_catalog")
        .select("ingested_at")
        .order("ingested_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    )
    .then(({ data }) => data?.ingested_at ?? null)
    .catch(() => null);
  const lastSilverSync = silverRows[0]?.silver_loaded_at ?? silverRows[0]?.published_at ?? null;

  return [
    {
      id: "cbs-bronze",
      name: "CBS Bronze",
      fullName: "Raw CBS StatLine ingestion layer",
      abbr: "B",
      datasets: bronzeDatasets,
      lastSync: formatDate(lastBronzeSync),
      coverage: "Raw API",
      reliability: bronzeDatasets > 0 ? 92 : 0,
      tags: ["Raw", "CBS", "Bronze"],
      brandColor: "#6B7280",
      metadata: [
        { label: "Datasets loaded", value: formatNumber(bronzeDatasets) },
        { label: "Preview rows", value: formatNumber(previewRows) },
        { label: "Completeness", value: bronzeDatasets > 0 ? "Public metadata available" : "Empty" },
      ],
    },
    {
      id: "cbs-silver",
      name: "CBS Silver",
      fullName: "Curated CBS relational analysis layer",
      abbr: "S",
      datasets: silverRows.length,
      lastSync: formatDate(lastSilverSync),
      coverage: "Curated",
      reliability: completeness(completedSilver, silverRows.length),
      tags: ["Curated", "CBS", "Silver"],
      brandColor: "#1C3D8F",
      metadata: [
        { label: "Loaded datasets", value: formatNumber(silverRows.length) },
        { label: "Complete", value: `${formatNumber(completedSilver)} / ${formatNumber(silverRows.length)}` },
        { label: "Observations", value: formatNumber(silverObservations) },
        { label: "Rejected rows", value: formatNumber(rejectedSilverRows) },
      ],
    },
  ];
}

export const connectorService = {
  async getAllConnectors(): Promise<Connector[]> {
    if (cachedConnectors) return cachedConnectors;
    cachedConnectors = await getLayerConnectors();
    return cachedConnectors;
  },

  async getConnectorById(id: string): Promise<Connector | undefined> {
    const all = await this.getAllConnectors();
    return all.find((c) => c.id === id);
  },

  async getTotalDatasetCount(): Promise<number> {
    const connectors = await this.getAllConnectors();
    return connectors.reduce((sum, c) => sum + c.datasets, 0);
  },

  async getConnectorCount(): Promise<number> {
    const connectors = await this.getAllConnectors();
    return connectors.length;
  },
};
