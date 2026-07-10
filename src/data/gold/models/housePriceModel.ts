import { getSupabaseClient } from "@/data/supabase/client";
import type { Database } from "@/data/supabase/types";
import type { GoldLineage, GoldModel, HousePriceDataPoint } from "../types";

type PreviewRow = Database["public"]["Tables"]["dataset_preview_rows"]["Row"];
type ChartCity = keyof Omit<HousePriceDataPoint, "year">;

const MODEL_VERSION = "housePriceModel@2.0.0";
const SOURCE_DATASET_ID = "85039NED";
const CITY_CODES: Record<string, ChartCity> = {
  GM0363: "Amsterdam",
  GM0344: "Utrecht",
  GM0599: "Rotterdam",
};

let cachedModel: GoldModel<HousePriceDataPoint[]> | null = null;

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

function findYear(row: Record<string, unknown>): string | undefined {
  return clean(row.Perioden)?.slice(0, 4);
}

function findCity(row: Record<string, unknown>): ChartCity | undefined {
  const code = clean(row.WijkenEnBuurten ?? row.RegioS)?.toUpperCase();
  return code ? CITY_CODES[code] : undefined;
}

function findWozThousands(row: Record<string, unknown>): number | undefined {
  for (const [key, value] of Object.entries(row)) {
    if (!/WOZ/i.test(key)) continue;
    const parsed = numberValue(value);
    if (parsed === undefined) continue;
    return parsed > 10_000 ? Math.round(parsed / 1000) : parsed;
  }
  return undefined;
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

async function buildModel(): Promise<GoldModel<HousePriceDataPoint[]>> {
  const rows = await getPreviewRows();
  const grouped = new Map<string, Partial<Record<ChartCity, number>>>();

  rows.forEach((previewRow) => {
    const row = previewRow.raw ?? {};
    const year = findYear(row);
    const city = findCity(row);
    const value = findWozThousands(row);
    if (!year || !city || value === undefined) return;
    grouped.set(year, { ...grouped.get(year), [city]: value });
  });

  const data = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, cities]) => ({
      year,
      Amsterdam: cities.Amsterdam ?? 0,
      Utrecht: cities.Utrecht ?? 0,
      Rotterdam: cities.Rotterdam ?? 0,
    }));

  const lineage: GoldLineage = {
    silverLineages: [],
    bronzeProvenances: [],
    calculations: [
      {
        field: "Amsterdam | Utrecht | Rotterdam",
        formula: "Read WOZ measures from Supabase public.dataset_preview_rows for a dataset already loaded into Silver.",
        silverInputs: ["public.dataset_preview_rows.raw", "public.silver_dataset_catalog.dataset_id"],
      },
    ],
    processedAt: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    qualityScore: data.length > 0 ? 90 : 0,
  };

  return { data, lineage };
}

export async function getHousePriceModel(): Promise<GoldModel<HousePriceDataPoint[]>> {
  if (!cachedModel) cachedModel = await buildModel();
  return cachedModel;
}

export async function getHousePriceData(): Promise<HousePriceDataPoint[]> {
  const model = await getHousePriceModel();
  return model.data;
}
