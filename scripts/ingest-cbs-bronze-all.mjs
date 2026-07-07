#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const CBS_ODATA_BASE = "https://opendata.cbs.nl/ODataApi/odata";
const CBS_CATALOG_BASE = "https://opendata.cbs.nl/ODataCatalog";
const LEVELS = ["neighborhood", "municipality", "province", "country"];

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

function parseArgs(argv) {
  const options = {
    dataset: "",
    query: "",
    limit: 10,
    tableOffset: 0,
    batchSize: 1000,
    maxRowsPerDataset: 0,
    dimensionsPerTable: 5000,
    includeRows: true,
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dataset") options.dataset = argv[++i] ?? "";
    else if (arg === "--query") options.query = argv[++i] ?? "";
    else if (arg === "--limit") options.limit = Number(argv[++i] ?? options.limit);
    else if (arg === "--table-offset") options.tableOffset = Number(argv[++i] ?? options.tableOffset);
    else if (arg === "--batch-size") options.batchSize = Number(argv[++i] ?? options.batchSize);
    else if (arg === "--max-rows-per-dataset") options.maxRowsPerDataset = Number(argv[++i] ?? 0);
    else if (arg === "--dimensions-per-table") options.dimensionsPerTable = Number(argv[++i] ?? options.dimensionsPerTable);
    else if (arg === "--metadata-only") options.includeRows = false;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help") {
      console.log(`Usage:
  npm run ingest:cbs:bronze:all -- --dataset 85039NED
  npm run ingest:cbs:bronze:all -- --query 2007 --limit 25
  npm run ingest:cbs:bronze:all -- --limit 100 --batch-size 1000
  npm run ingest:cbs:bronze:all -- --dataset 85039NED --max-rows-per-dataset 5000
  npm run ingest:cbs:bronze:all -- --metadata-only --limit 100
  npm run ingest:cbs:bronze:all -- --dry-run --dataset 85039NED

Required env for writes:
  VITE_SUPABASE_URL or SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Notes:
  --limit controls number of CBS tables, not rows.
  --max-rows-per-dataset 0 means all rows.
  Re-running is safe: rows upsert by dataset_id + row_id.
`);
      process.exit(0);
    }
  }

  return options;
}

function buildQuery(query = {}) {
  const params = new URLSearchParams();
  params.set("$format", "json");
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  });
  return params.toString();
}

function escapeODataString(value) {
  return value.replace(/'/g, "''");
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} for ${url}${body ? `: ${body.slice(0, 300)}` : ""}`);
  }
  return response.json();
}

async function getCatalogTables(options) {
  const select = "Identifier,Title,ShortTitle,ShortDescription,Updated,Period,Language,Catalog";
  if (options.dataset) {
    const url = `${CBS_CATALOG_BASE}/Tables?${buildQuery({
      $select: select,
      $filter: `Identifier eq '${escapeODataString(options.dataset)}'`,
      $top: 1,
    })}`;
    return (await getJson(url)).value ?? [];
  }

  const filters = ["Language eq 'nl'"];
  if (options.query) {
    const escaped = escapeODataString(options.query);
    filters.push(`(substringof('${escaped}',Title) or substringof('${escaped}',ShortTitle) or substringof('${escaped}',ShortDescription) or substringof('${escaped}',Period))`);
  }

  const url = `${CBS_CATALOG_BASE}/Tables?${buildQuery({
    $select: select,
    $filter: filters.join(" and "),
    $top: Math.max(1, options.limit),
    $skip: Math.max(0, options.tableOffset),
  })}`;
  return (await getJson(url)).value ?? [];
}

async function getDataProperties(datasetId) {
  const url = `${CBS_ODATA_BASE}/${datasetId}/DataProperties?${buildQuery({})}`;
  return (await getJson(url)).value ?? [];
}

async function getTypedDataSetCount(datasetId) {
  const response = await fetch(`${CBS_ODATA_BASE}/${datasetId}/TypedDataSet/$count`);
  if (!response.ok) return null;
  const count = Number(await response.text());
  return Number.isFinite(count) ? count : null;
}

async function getDimensionValues(datasetId, dimensionKey, query = {}) {
  const url = `${CBS_ODATA_BASE}/${datasetId}/${encodeURIComponent(dimensionKey)}?${buildQuery(query)}`;
  try {
    return (await getJson(url)).value ?? [];
  } catch {
    return [];
  }
}

async function getTypedRows(datasetId, query = {}) {
  const url = `${CBS_ODATA_BASE}/${datasetId}/TypedDataSet?${buildQuery(query)}`;
  return (await getJson(url)).value ?? [];
}

function yearFromPeriodKey(value) {
  const year = Number(String(value ?? "").slice(0, 4));
  return Number.isInteger(year) && year >= 1970 && year <= 2026 ? year : undefined;
}

function extractYears(text) {
  return Array.from(String(text ?? "").matchAll(/(?:19|20)\d{2}/g))
    .map((match) => Number(match[0]))
    .filter((year) => year >= 1970 && year <= 2026);
}

function expandYearRange(years) {
  const unique = Array.from(new Set(years)).sort((a, b) => a - b);
  if (unique.length < 2) return unique;
  const min = unique[0];
  const max = unique[unique.length - 1];
  if (max - min > 80) return unique;
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

function levelFromDimension(value) {
  const key = String(value.DetailRegionCode || value.Key || "").trim().toUpperCase();
  const title = String(value.Title || "").trim().toLowerCase();
  const description = String(value.Description || "").toLowerCase();
  if (key === "NL00" || key === "NL01" || title === "nederland") return "country";
  if (key.startsWith("PV") || title.includes("(pv)") || description.includes("pv = provincie")) return "province";
  if (key.startsWith("GM")) return "municipality";
  if (key.startsWith("WK") || key.startsWith("BU")) return "neighborhood";
  return "other";
}

function spatialCoverageForLevels(levels) {
  const set = new Set(levels);
  if (set.has("country") && set.has("municipality") && set.has("neighborhood")) {
    return "Netherlands — all municipalities, wijken and buurten";
  }
  if (set.has("country") && set.has("province") && set.has("municipality")) {
    return "Netherlands — country, provinces and municipalities";
  }
  if (set.has("province")) return "Netherlands — provinces";
  if (set.has("municipality")) return "Netherlands — municipalities";
  if (set.has("country")) return "Netherlands — country";
  if (set.has("neighborhood")) return "Netherlands — wijken and buurten";
  return null;
}

function qualifyDataset(table, properties, dimensionValuesByKey, recordCount) {
  const timeProperty = properties.find((property) => property.Key === "Perioden" || property.Type === "TimeDimension");
  const geographyProperty = properties.find((property) => property.Type?.includes("Geo"));
  const periodValues = timeProperty ? dimensionValuesByKey.get(timeProperty.Key) ?? [] : [];
  const periodenYears = Array.from(new Set(periodValues.map((value) => yearFromPeriodKey(value.Key)).filter(Boolean))).sort((a, b) => a - b);
  const catalogPeriodYears = expandYearRange(extractYears(table.Period));
  const catalogTextYears = expandYearRange(extractYears(`${table.Title} ${table.ShortTitle} ${table.ShortDescription}`));
  const years = periodenYears.length ? periodenYears : catalogPeriodYears.length ? catalogPeriodYears : catalogTextYears;
  const periodSource = periodenYears.length
    ? "perioden-dimension"
    : catalogPeriodYears.length
      ? "catalog-period"
      : catalogTextYears.length
        ? "catalog-text"
        : "none";
  const geographyValues = geographyProperty ? dimensionValuesByKey.get(geographyProperty.Key) ?? [] : [];
  const geographicLevels = Array.from(new Set(geographyValues.map(levelFromDimension).filter((level) => LEVELS.includes(level))));
  const spatialCoverage = spatialCoverageForLevels(geographicLevels);
  const evidence = [
    timeProperty ? `Years from CBS ${timeProperty.Key} dimension using first four characters of each key` : "No CBS Perioden dimension found",
    periodSource === "catalog-period" ? "Years expanded from CBS catalog Period" : undefined,
    periodSource === "catalog-text" ? "Years inferred from CBS catalog title/description" : undefined,
    geographyProperty ? `Levels from CBS dimension ${geographyProperty.Key}` : "No CBS geography dimension found",
    spatialCoverage ? `Spatial coverage: ${spatialCoverage}` : undefined,
    recordCount !== null ? "Record count from TypedDataSet/$count" : "Record count unavailable",
  ].filter(Boolean);

  return {
    yearStart: years.length ? years[0] : null,
    yearEnd: years.length ? years[years.length - 1] : null,
    years,
    geographicLevels,
    spatialCoverage,
    periodSource,
    confidence: timeProperty || geographyProperty ? "cbs-metadata" : years.length ? "partial-metadata" : "unqualified",
    evidence,
  };
}

function catalogBronzeRow(table) {
  return {
    identifier: table.Identifier,
    title: table.Title,
    short_title: table.ShortTitle,
    short_description: table.ShortDescription,
    language: table.Language,
    catalog: table.Catalog,
    period: table.Period,
    updated_at: table.Updated,
    raw: table,
    ingested_at: new Date().toISOString(),
  };
}

function propertyBronzeRows(datasetId, properties) {
  const now = new Date().toISOString();
  return properties.map((property) => ({
    dataset_id: datasetId,
    property_id: property.ID,
    key: property.Key || null,
    title: property.Title || null,
    type: property.Type || null,
    parent_id: property.ParentID,
    position: property.Position,
    raw: property,
    ingested_at: now,
  }));
}

function dimensionBronzeRows(datasetId, dimensionKey, values) {
  const now = new Date().toISOString();
  return values.map((value) => ({
    dataset_id: datasetId,
    dimension_key: dimensionKey,
    key: value.Key,
    title: value.Title,
    description: value.Description,
    raw: value,
    ingested_at: now,
  }));
}

function typedDatasetRows(datasetId, rows, skip) {
  const now = new Date().toISOString();
  return rows.map((row, index) => {
    const rowIndex = skip + index;
    return {
      dataset_id: datasetId,
      row_id: row.ID === undefined || row.ID === null ? String(rowIndex) : String(row.ID),
      row_index: rowIndex,
      raw: row,
      ingested_at: now,
    };
  });
}

function publicDatasetRow(table, qualification, recordCount) {
  return {
    id: table.Identifier,
    provider: "CBS",
    title: table.ShortTitle || table.Title,
    description: table.ShortDescription || table.Title,
    updated_at: table.Updated,
    record_count: recordCount,
    year_start: qualification.yearStart,
    year_end: qualification.yearEnd,
    years: qualification.years,
    geographic_levels: qualification.geographicLevels,
    spatial_coverage: qualification.spatialCoverage,
    period_source: qualification.periodSource,
    qualification_confidence: qualification.confidence,
    qualification_evidence: qualification.evidence,
    source_url: `${CBS_ODATA_BASE}/${table.Identifier}`,
    ingested_at: new Date().toISOString(),
  };
}

function publicDimensionRows(datasetId, properties, dimensionValuesByKey) {
  const now = new Date().toISOString();
  return properties
    .filter((property) => property.Key && (property.Type?.includes("Dimension") || property.Type?.includes("Geo")))
    .map((property) => ({
      dataset_id: datasetId,
      key: property.Key,
      title: property.Title || property.Key,
      type: property.Type,
      values_count: dimensionValuesByKey.get(property.Key)?.length ?? null,
      ingested_at: now,
    }));
}

async function upsertOrThrow(supabase, table, rows, options = {}) {
  if (rows.length === 0) return;
  const target = table.startsWith("bronze.")
    ? supabase.schema("bronze").from(table.replace("bronze.", ""))
    : supabase.from(table);
  const { error } = await target.upsert(rows, options);
  if (error) throw error;
}

async function ingestTypedRows(supabase, datasetId, recordCount, options) {
  if (!options.includeRows) return 0;
  const maxRows = options.maxRowsPerDataset > 0
    ? Math.min(options.maxRowsPerDataset, recordCount ?? options.maxRowsPerDataset)
    : recordCount;
  if (!maxRows) return 0;

  let written = 0;
  for (let skip = 0; skip < maxRows; skip += options.batchSize) {
    const top = Math.min(options.batchSize, maxRows - skip);
    const rows = await getTypedRows(datasetId, { $top: top, $skip: skip });
    if (rows.length === 0) break;
    if (!options.dryRun) {
      await upsertOrThrow(
        supabase,
        "bronze.cbs_typed_dataset_rows",
        typedDatasetRows(datasetId, rows, skip),
        { onConflict: "dataset_id,row_id" }
      );
    }
    written += rows.length;
    console.log(`  rows ${written}/${maxRows} (${datasetId})`);
    if (rows.length < top) break;
  }
  return written;
}

async function ingestTable(supabase, table, options) {
  const datasetId = table.Identifier;
  const properties = await getDataProperties(datasetId);
  const dimensionProperties = properties.filter((property) => property.Key && (property.Type?.includes("Dimension") || property.Type?.includes("Geo")));
  const dimensionValuesByKey = new Map();

  for (const property of dimensionProperties) {
    const values = await getDimensionValues(datasetId, property.Key, { $top: options.dimensionsPerTable });
    dimensionValuesByKey.set(property.Key, values);
  }

  const recordCount = await getTypedDataSetCount(datasetId);
  const qualification = qualifyDataset(table, properties, dimensionValuesByKey, recordCount);

  if (options.dryRun) {
    console.log(JSON.stringify({
      datasetId,
      title: table.ShortTitle || table.Title,
      recordCount,
      rowsToIngest: options.includeRows ? (options.maxRowsPerDataset > 0 ? Math.min(options.maxRowsPerDataset, recordCount ?? 0) : recordCount) : 0,
      years: [qualification.yearStart, qualification.yearEnd],
      levels: qualification.geographicLevels,
      dimensions: dimensionProperties.length,
    }));
    return;
  }

  await upsertOrThrow(supabase, "bronze.cbs_catalog_tables", [catalogBronzeRow(table)], { onConflict: "identifier" });
  await upsertOrThrow(supabase, "bronze.cbs_data_properties", propertyBronzeRows(datasetId, properties), { onConflict: "dataset_id,property_id" });

  for (const property of dimensionProperties) {
    await upsertOrThrow(
      supabase,
      "bronze.cbs_dimension_values",
      dimensionBronzeRows(datasetId, property.Key, dimensionValuesByKey.get(property.Key) ?? []),
      { onConflict: "dataset_id,dimension_key,key" }
    );
  }

  await upsertOrThrow(supabase, "dataset_catalog", [publicDatasetRow(table, qualification, recordCount)], { onConflict: "id" });
  await upsertOrThrow(supabase, "dataset_dimensions", publicDimensionRows(datasetId, properties, dimensionValuesByKey), { onConflict: "dataset_id,key" });

  const writtenRows = await ingestTypedRows(supabase, datasetId, recordCount, options);
  console.log(`Ingested ${datasetId}: ${writtenRows} data rows, ${qualification.years.length} years, ${qualification.geographicLevels.join(", ") || "no levels"}`);
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL.");
  if (!options.dryRun && !serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Do not use the anon key for ingestion writes.");
  }

  const supabase = options.dryRun
    ? null
    : createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

  const tables = await getCatalogTables(options);
  console.log(`Found ${tables.length} CBS table(s) to ingest.`);

  for (const table of tables) {
    await ingestTable(supabase, table, options);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
