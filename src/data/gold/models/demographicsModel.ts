import { getSupabaseClient } from "@/data/supabase/client";
import type { Database } from "@/data/supabase/types";
import type { AgingDataPoint, GoldLineage, GoldModel } from "../types";

type PreviewRow = Database["public"]["Tables"]["dataset_preview_rows"]["Row"];

const MODEL_VERSION = "demographicsModel@2.0.0";
const SOURCE_DATASET_ID = "85039NED";
const TOP_N = 6;

let cachedModel: GoldModel<AgingDataPoint[]> | null = null;

function clean(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function findNumber(row: Record<string, unknown>, patterns: RegExp[]): number | undefined {
  for (const [key, value] of Object.entries(row)) {
    if (!patterns.some((pattern) => pattern.test(key))) continue;
    const parsed = numberValue(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function findMunicipalityName(row: Record<string, unknown>): string {
  return clean(row.Gemeentenaam_1 ?? row.Naam_2 ?? row.RegioNaam ?? row.WijkenEnBuurten ?? row.RegioS) ?? "Unknown";
}

function shortenName(name: string): string {
  return name.length > 13 ? `${name.slice(0, 12)}.` : name;
}

async function getPreviewRows(): Promise<PreviewRow[]> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("dataset_preview_rows")
    .select("*")
    .eq("dataset_id", SOURCE_DATASET_ID)
    .order("row_index", { ascending: true })
    .limit(25);

  if (error) throw error;
  return data ?? [];
}

async function buildModel(): Promise<GoldModel<AgingDataPoint[]>> {
  const rows = await getPreviewRows();
  const data = rows
    .map((previewRow) => {
      const row = previewRow.raw ?? {};
      const totalPopulation = findNumber(row, [/BevolkingAantalInwoners/i, /^TotaleBevolking/i, /Bevolking/i]) ?? 0;
      const population65Plus =
        findNumber(row, [/k_65JaarOfOuder/i]) ??
        ((findNumber(row, [/k_65Tot80Jaar/i]) ?? 0) + (findNumber(row, [/k_80JaarOfOuder/i]) ?? 0));
      const pct = totalPopulation > 0 ? Math.round((population65Plus / totalPopulation) * 1000) / 10 : 0;
      const municipalityFull = findMunicipalityName(row);

      return {
        municipality: shortenName(municipalityFull),
        municipalityFull,
        pct,
        totalPopulation,
        population65Plus,
      };
    })
    .filter((row) => row.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, TOP_N);

  const lineage: GoldLineage = {
    silverLineages: [],
    bronzeProvenances: [],
    calculations: [
      {
        field: "pct",
        formula: "population65Plus / totalPopulation * 100 using Supabase public.dataset_preview_rows for a dataset already loaded into Silver.",
        silverInputs: ["public.dataset_preview_rows.raw", "public.silver_dataset_catalog.dataset_id"],
      },
    ],
    processedAt: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    qualityScore: data.length > 0 ? 90 : 0,
  };

  return { data, lineage };
}

export async function getDemographicsModel(): Promise<GoldModel<AgingDataPoint[]>> {
  if (!cachedModel) cachedModel = await buildModel();
  return cachedModel;
}

export async function getAgingData(): Promise<AgingDataPoint[]> {
  const model = await getDemographicsModel();
  return model.data;
}
