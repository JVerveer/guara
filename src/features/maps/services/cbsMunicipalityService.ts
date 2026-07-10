import { getSupabaseClient } from "@/data/supabase/client";
import type { Database } from "@/data/supabase/types";
import type { DatasetValue, Municipality, MunicipalityMetadata } from "@/features/maps/types";

type PreviewRow = Database["public"]["Tables"]["dataset_preview_rows"]["Row"];
type SilverCatalogRow = Database["public"]["Tables"]["silver_dataset_catalog"]["Row"];

export interface CbsMunicipalityMapSnapshot {
  municipalities: Municipality[];
  metadataById: Record<string, MunicipalityMetadata>;
  datasetValues: DatasetValue[];
}

const PREFERRED_MUNICIPALITY_DATASETS = ["70072NED", "85039NED"];
const MAP_YEAR_FALLBACK = 2024;
const MUNICIPALITY_CODE_FIELDS = ["RegioS", "WijkenEnBuurten", "Gebieden", "Regio", "RegionS"];
const MUNICIPALITY_NAME_FIELDS = ["Gemeentenaam_1", "Naam_2", "RegioNaam", "Regionaam", "RegioS", "WijkenEnBuurten"];

function cellPath(index: number): { path: string; centroid: [number, number] } {
  const columns = 5;
  const cellWidth = 54;
  const cellHeight = 42;
  const gap = 5;
  const row = Math.floor(index / columns);
  const column = index % columns;
  const x = 78 + column * (cellWidth + gap) + (row % 2) * 14;
  const y = 70 + row * (cellHeight + gap);
  const path = `M${x} ${y} L${x + cellWidth} ${y + 4} L${x + cellWidth - 5} ${y + cellHeight} L${x + 4} ${y + cellHeight - 2} Z`;

  return {
    path,
    centroid: [x + cellWidth / 2, y + cellHeight / 2],
  };
}

function clean(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function findValue(row: Record<string, unknown>, patterns: RegExp[]): number {
  for (const [key, value] of Object.entries(row)) {
    if (patterns.some((pattern) => pattern.test(key))) {
      const parsed = numberValue(value);
      if (parsed !== undefined) return parsed;
    }
  }
  return 0;
}

function findCode(row: Record<string, unknown>): string | undefined {
  for (const field of MUNICIPALITY_CODE_FIELDS) {
    const value = clean(row[field]);
    if (value?.toUpperCase().startsWith("GM")) return value.toUpperCase();
  }
  return undefined;
}

function findName(row: Record<string, unknown>, code: string): string {
  for (const field of MUNICIPALITY_NAME_FIELDS) {
    const value = clean(row[field]);
    if (value && value !== code) return value;
  }
  return code;
}

function findYear(row: Record<string, unknown>): number {
  const period = clean(row.Perioden)?.slice(0, 4);
  const year = period ? Number(period) : Number.NaN;
  return Number.isFinite(year) ? year : MAP_YEAR_FALLBACK;
}

async function getMunicipalityDataset(silverRows: SilverCatalogRow[]): Promise<SilverCatalogRow | undefined> {
  const preferred = PREFERRED_MUNICIPALITY_DATASETS
    .map((id) => silverRows.find((row) => row.dataset_id === id))
    .find(Boolean);
  if (preferred) return preferred;

  const ids = silverRows.map((row) => row.dataset_id);
  if (ids.length === 0) return undefined;

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("dataset_catalog")
    .select("id,geographic_levels")
    .in("id", ids);

  if (error) throw error;
  const municipalityIds = new Set(
    (data ?? [])
      .filter((row) => row.geographic_levels.includes("municipality"))
      .map((row) => row.id)
  );

  return silverRows.find((row) => municipalityIds.has(row.dataset_id));
}

async function getPreviewRows(datasetId: string): Promise<PreviewRow[]> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("dataset_preview_rows")
    .select("*")
    .eq("dataset_id", datasetId)
    .order("row_index", { ascending: true })
    .limit(25);

  if (error) throw error;
  return data ?? [];
}

export async function getCbsMunicipalityMapSnapshot(): Promise<CbsMunicipalityMapSnapshot> {
  const supabase = await getSupabaseClient();
  const { data: silverRows, error } = await supabase
    .from("silver_dataset_catalog")
    .select("*")
    .order("silver_loaded_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  const dataset = await getMunicipalityDataset(silverRows ?? []);
  if (!dataset) return { municipalities: [], metadataById: {}, datasetValues: [] };

  const previewRows = await getPreviewRows(dataset.dataset_id);
  const seen = new Set<string>();
  const municipalityRows = previewRows
    .map((previewRow) => ({ previewRow, code: findCode(previewRow.raw ?? {}) }))
    .filter((item): item is { previewRow: PreviewRow; code: string } => Boolean(item.code))
    .filter(({ code }) => {
      if (seen.has(code)) return false;
      seen.add(code);
      return true;
    });

  const municipalities: Municipality[] = municipalityRows.map(({ previewRow, code }, index) => {
    const { path, centroid } = cellPath(index);
    const name = findName(previewRow.raw ?? {}, code);

    return {
      id: code,
      cbsCode: code.replace(/^GM/, ""),
      name,
      province: "Supabase silver",
      level: "municipality",
      centroid,
      geometry: { type: "svg-path", path },
      disabled: false,
    };
  });

  const metadataById = municipalityRows.reduce<Record<string, MunicipalityMetadata>>((acc, { previewRow, code }) => {
    const row = previewRow.raw ?? {};
    const name = findName(row, code);
    const population = findValue(row, [/TotaleBevolking/i, /Bevolking/i]);
    const housePrice = findValue(row, [/WOZ/i]) * 1000;
    const density = findValue(row, [/Dichtheid/i]);

    acc[code] = {
      population: Math.round(population),
      medianAge: 0,
      income: 0,
      housePrice: Math.round(housePrice),
      dataAvailable: Object.keys(row).length,
      relatedDatasets: [`${dataset.dataset_id} ${dataset.title}`],
      evidence: [
        `Loaded from Supabase silver projection: ${dataset.dataset_id}`,
        density ? `Population density: ${Math.round(density).toLocaleString("en-US")} residents/km2` : "Population density not present in preview row",
      ],
      recentResearch: [],
      suggestedQuestions: [
        `Show ${name} population`,
        `Compare ${name} with another municipality`,
        `Inspect source variables for ${name}`,
      ],
    };
    return acc;
  }, {});

  const datasetValues: DatasetValue[] = municipalityRows.flatMap(({ previewRow, code }) => {
    const row = previewRow.raw ?? {};
    const year = findYear(row);
    const population = findValue(row, [/TotaleBevolking/i, /Bevolking/i]);
    const housePrice = findValue(row, [/WOZ/i]) * 1000;
    const density = findValue(row, [/Dichtheid/i]);
    const source = {
      provider: "Supabase silver",
      lastUpdated: dataset.silver_loaded_at ?? dataset.published_at,
      confidence: 1,
    };

    return [
      { municipalityId: code, geographicLevel: "municipality" as const, datasetId: "cbs-silver", indicator: "population", year, value: population, unit: "residents", source },
      { municipalityId: code, geographicLevel: "municipality" as const, datasetId: "cbs-silver", indicator: "housing", year, value: housePrice, unit: "EUR", source },
      { municipalityId: code, geographicLevel: "municipality" as const, datasetId: "cbs-silver", indicator: "density", year, value: density, unit: "residents/km2", source },
    ];
  });

  return { municipalities, metadataById, datasetValues };
}
