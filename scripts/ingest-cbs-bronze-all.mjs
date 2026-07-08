#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const CBS_ODATA_BASE = "https://opendata.cbs.nl/ODataApi/odata";
const CBS_ODATA_FEED_BASE = "https://opendata.cbs.nl/ODataFeed/odata";
const CBS_CATALOG_BASE = "https://opendata.cbs.nl/ODataCatalog";

const REQUIRED_BRONZE_TABLES = [
  "cbs_raw_endpoint_payloads",
  "cbs_typed_dataset_rows",
  "cbs_ingestion_runs",
  "cbs_dataset_ingestion_status",
];

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
    all: false,
    failedOnly: false,
    tableOffset: 0,
    catalogPageSize: 100,
    batchSize: 1000,
    maxRowsPerDataset: 0,
    dimensionBatchSize: 5000,
    includeRows: true,
    dryRun: false,
    retries: 2,
    force: false,
    requestDelayMs: 100,
    requestTimeoutMs: 60000,
    resumeRows: true,
    storeTypedBatchPayloads: true,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--dataset") options.dataset = argv[++i] ?? "";
    else if (arg === "--query") options.query = argv[++i] ?? "";
    else if (arg === "--limit") options.limit = Number(argv[++i] ?? options.limit);
    else if (arg === "--all") options.all = true;
    else if (arg === "--failed-only") options.failedOnly = true;
    else if (arg === "--table-offset") options.tableOffset = Number(argv[++i] ?? options.tableOffset);
    else if (arg === "--catalog-page-size") options.catalogPageSize = Number(argv[++i] ?? options.catalogPageSize);
    else if (arg === "--batch-size") options.batchSize = Number(argv[++i] ?? options.batchSize);
    else if (arg === "--max-rows-per-dataset") options.maxRowsPerDataset = Number(argv[++i] ?? 0);
    else if (arg === "--dimension-batch-size") options.dimensionBatchSize = Number(argv[++i] ?? options.dimensionBatchSize);
    else if (arg === "--retries") options.retries = Number(argv[++i] ?? options.retries);
    else if (arg === "--request-delay-ms") options.requestDelayMs = Number(argv[++i] ?? options.requestDelayMs);
    else if (arg === "--request-timeout-ms") options.requestTimeoutMs = Number(argv[++i] ?? options.requestTimeoutMs);
    else if (arg === "--metadata-only") options.includeRows = false;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--no-resume-rows") options.resumeRows = false;
    else if (arg === "--no-store-typed-batch-payloads") options.storeTypedBatchPayloads = false;
    else if (arg === "--help") {
      console.log(`Usage:
  npm run ingest:cbs:bronze:all -- --dataset 85039NED
  npm run ingest:cbs:bronze:all -- --query bevolking --limit 25
  npm run ingest:cbs:bronze:all -- --all
  npm run ingest:cbs:bronze:all -- --all --metadata-only
  npm run ingest:cbs:bronze:all -- --failed-only
  npm run ingest:cbs:bronze:all -- --dataset 85039NED --force
  npm run ingest:cbs:bronze:all -- --all --retries 5
  npm run ingest:cbs:bronze:all -- --all --request-delay-ms 250
  npm run ingest:cbs:bronze:all -- --dataset 85039NED --max-rows-per-dataset 5000

Required env:
  VITE_SUPABASE_URL or SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Notes:
  This is a raw Bronze ingestion script.
  It stores CBS source responses as raw JSON payloads.
  It does not transform, qualify, label, enrich, or normalize CBS data.

Options:
  --all                            Page through the complete CBS catalog.
  --failed-only                    Only ingest datasets with failed/partial status.
  --force                          Re-ingest even if already completed and unchanged.
  --metadata-only                  Store catalog/properties/dimensions, skip rows.
  --retries 5                      Retry failed datasets.
  --request-delay-ms 250           Add delay between CBS API requests.
  --request-timeout-ms 60000       Timeout per CBS request.
  --batch-size 1000                TypedDataSet row batch size.
  --dimension-batch-size 5000      Dimension values batch size.
  --no-resume-rows                 Disable row-level resume.
  --no-store-typed-batch-payloads  Do not store TypedDataSet batch payloads.
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
  return String(value).replace(/'/g, "''");
}

function extractYearsFromText(value) {
  return Array.from(String(value ?? "").matchAll(/(?:19|20)\d{2}/g))
    .map((match) => Number(match[0]))
    .filter((year) => Number.isInteger(year) && year >= 1970 && year <= 2026);
}

function expandYearRange(years) {
  if (years.length < 2) return years;
  const min = Math.min(...years);
  const max = Math.max(...years);
  if (max - min > 80) return years;
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

function extractPeriodenYears(dimensionPayloads) {
  const years = new Set();

  for (const dimension of dimensionPayloads) {
    if (dimension.key !== "Perioden") continue;
    for (const value of dimension.payload?.value ?? []) {
      const year = Number(String(value?.Key ?? "").slice(0, 4));
      if (Number.isInteger(year) && year >= 1970 && year <= 2026) years.add(year);
    }
  }

  return Array.from(years).sort((a, b) => a - b);
}

function levelFromCbsGeoValue(value) {
  const key = String(value?.Key ?? value?.DetailRegionCode ?? "").trim().toUpperCase();
  const title = String(value?.Title ?? "").trim().toLowerCase();
  const description = String(value?.Description ?? "").trim().toLowerCase();

  if (key === "NL00" || key === "NL01" || key === "NL" || title === "nederland") return "country";
  if (key.startsWith("PV") || description.includes("pv = provincie") || title.includes("(pv)")) return "province";
  if (key.startsWith("GM")) return "municipality";
  if (key.startsWith("WK") || key.startsWith("BU")) return "neighborhood";
  return null;
}

function geographyLevelsFromDimensionPayloads(dimensionPayloads) {
  const levels = new Set();

  for (const dimension of dimensionPayloads) {
    for (const value of dimension.payload?.value ?? []) {
      const level = levelFromCbsGeoValue(value);
      if (level) levels.add(level);
    }
  }

  return Array.from(levels);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url, options) {
  if (options.requestDelayMs > 0) {
    await sleep(options.requestDelayMs);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `HTTP ${response.status} for ${url}${body ? `: ${body.slice(0, 300)}` : ""}`
      );
    }

    return response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Request timeout after ${options.requestTimeoutMs}ms for ${url}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function validateSupabaseTables(supabase) {
  for (const table of REQUIRED_BRONZE_TABLES) {
    const { error } = await supabase
      .schema("bronze")
      .from(table)
      .select("*")
      .limit(1);

    if (error) {
      throw new Error(
        `Required table bronze.${table} is missing or not accessible: ${error.message}`
      );
    }
  }
}

async function getCatalogTablesPage(options, top, skip) {
  const select = "Identifier,Title,ShortTitle,ShortDescription,Updated,Period,Language,Catalog";

  if (options.dataset) {
    const url = `${CBS_CATALOG_BASE}/Tables?${buildQuery({
      $select: select,
      $filter: `Identifier eq '${escapeODataString(options.dataset)}'`,
      $top: 1,
    })}`;

    const payload = await getJson(url, options);
    return payload.value ?? [];
  }

  const filters = ["Language eq 'nl'"];

  if (options.query) {
    const escaped = escapeODataString(options.query);
    filters.push(
      `(substringof('${escaped}',Title) or substringof('${escaped}',ShortTitle) or substringof('${escaped}',ShortDescription) or substringof('${escaped}',Period))`
    );
  }

  const url = `${CBS_CATALOG_BASE}/Tables?${buildQuery({
    $select: select,
    $filter: filters.join(" and "),
    $top: top,
    $skip: skip,
  })}`;

  const payload = await getJson(url, options);
  return payload.value ?? [];
}

async function getCatalogTables(options) {
  if (options.dataset) {
    return getCatalogTablesPage(options, 1, 0);
  }

  if (!options.all) {
    return getCatalogTablesPage(
      options,
      Math.max(1, options.limit),
      Math.max(0, options.tableOffset)
    );
  }

  const allTables = [];
  let skip = Math.max(0, options.tableOffset);
  const top = Math.max(1, options.catalogPageSize);

  while (true) {
    const page = await getCatalogTablesPage(options, top, skip);
    allTables.push(...page);

    console.log(`Catalog discovery: ${allTables.length} table(s) loaded`);

    if (page.length < top) break;
    skip += top;
  }

  return allTables;
}

async function getDataPropertiesPayload(datasetId, options) {
  const url = `${CBS_ODATA_BASE}/${datasetId}/DataProperties?${buildQuery({})}`;
  return {
    url,
    payload: await getJson(url, options),
  };
}

async function getTypedDataSetCount(datasetId, options) {
  const url = `${CBS_ODATA_BASE}/${datasetId}/TypedDataSet/$count`;

  if (options.requestDelayMs > 0) {
    await sleep(options.requestDelayMs);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const count = Number(await response.text());
    return Number.isFinite(count) ? count : null;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Request timeout after ${options.requestTimeoutMs}ms for ${url}`);
    }

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getDimensionValuesPayload(datasetId, dimensionKey, skip, top, options) {
  const url = `${CBS_ODATA_BASE}/${datasetId}/${encodeURIComponent(dimensionKey)}?${buildQuery({
    $top: top,
    $skip: skip,
  })}`;

  try {
    return {
      url,
      payload: await getJson(url, options),
    };
  } catch {
    return {
      url,
      payload: { value: [] },
    };
  }
}

async function getAllDimensionPayloads(datasetId, dimensionKey, options) {
  const payloads = [];
  const top = Math.max(1, options.dimensionBatchSize);

  for (let skip = 0; ; skip += top) {
    const result = await getDimensionValuesPayload(datasetId, dimensionKey, skip, top, options);
    const values = result.payload.value ?? [];

    payloads.push({
      key: dimensionKey,
      skip,
      top,
      sourceUrl: result.url,
      payload: result.payload,
      count: values.length,
    });

    if (values.length < top) break;
  }

  return payloads;
}

async function getTypedRows(datasetId, skip, top, options) {
  const url = `${CBS_ODATA_FEED_BASE}/${datasetId}/TypedDataSet?${buildQuery({
    $top: top,
    $skip: skip,
  })}`;

  const payload = await getJson(url, options);

  return {
    url,
    payload,
    rows: payload.value ?? [],
  };
}

function typedDatasetRows(datasetId, rows, skip, sourceUrl) {
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

async function upsertOrThrow(supabase, table, rows, options = {}) {
  if (rows.length === 0) return;

  const target = table.startsWith("bronze.")
    ? supabase.schema("bronze").from(table.replace("bronze.", ""))
    : supabase.from(table);

  const { error } = await target.upsert(rows, options);
  if (error) throw error;
}

async function upsertRawPayload(supabase, datasetId, endpoint, sourceUrl, payload) {
  await upsertOrThrow(
    supabase,
    "bronze.cbs_raw_endpoint_payloads",
    [
      {
        dataset_id: datasetId,
        endpoint,
        source_url: sourceUrl,
        payload,
        ingested_at: new Date().toISOString(),
      },
    ],
    { onConflict: "dataset_id,endpoint" }
  );
}

async function publishPublicDatasetMetadata(
  supabase,
  table,
  properties,
  dimensionPayloads,
  recordCount
) {
  const datasetId = table.Identifier;
  const periodenYears = extractPeriodenYears(dimensionPayloads);
  const catalogPeriodYears = expandYearRange(extractYearsFromText(table.Period));
  const catalogTextYears = expandYearRange(
    extractYearsFromText(`${table.Title ?? ""} ${table.ShortTitle ?? ""} ${table.ShortDescription ?? ""}`)
  );
  const years = periodenYears.length
    ? periodenYears
    : catalogPeriodYears.length
      ? catalogPeriodYears
      : catalogTextYears;
  const geographicLevels = geographyLevelsFromDimensionPayloads(dimensionPayloads);
  const spatialCoverage = spatialCoverageForLevels(geographicLevels);
  const periodSource = periodenYears.length
    ? "perioden-dimension"
    : catalogPeriodYears.length
      ? "catalog-period"
      : catalogTextYears.length
        ? "catalog-text"
        : "none";
  const dimensionProperties = properties.filter(
    (property) =>
      property.Key &&
      (
        property.Type?.includes("Dimension") ||
        property.Type?.includes("Geo") ||
        property.Type === "TimeDimension"
      )
  );
  const valueCounts = new Map(
    dimensionPayloads.map((dimension) => [dimension.key, dimension.count ?? dimension.payload?.value?.length ?? null])
  );
  const evidence = [
    periodenYears.length ? "Years from CBS Perioden dimension using first four characters of each key" : "No CBS Perioden dimension found",
    periodSource === "catalog-period" ? "Years expanded from CBS catalog Period" : null,
    periodSource === "catalog-text" ? "Years inferred from CBS catalog title/description" : null,
    geographicLevels.length ? "Geographic levels from CBS geography dimension values" : "No CBS geography dimension values identified",
    spatialCoverage ? `Spatial coverage: ${spatialCoverage}` : null,
    recordCount !== null && recordCount !== undefined ? "Record count from CBS TypedDataSet/$count" : "Record count unavailable",
  ].filter(Boolean);

  const catalogResult = await supabase
    .from("dataset_catalog")
    .upsert(
      {
        id: datasetId,
        provider: "CBS",
        title: table.ShortTitle || table.Title,
        description: table.ShortDescription || table.Title,
        updated_at: table.Updated ?? null,
        record_count: recordCount,
        year_start: years.length ? Math.min(...years) : null,
        year_end: years.length ? Math.max(...years) : null,
        years,
        geographic_levels: geographicLevels,
        spatial_coverage: spatialCoverage,
        period_source: periodSource,
        qualification_confidence: dimensionProperties.length ? "cbs-metadata" : years.length ? "partial-metadata" : "unqualified",
        qualification_evidence: evidence,
        source_url: `${CBS_ODATA_BASE}/${datasetId}`,
        ingested_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (catalogResult.error) {
    console.warn(`  skipped public dataset catalog publish for ${datasetId}: ${catalogResult.error.message}`);
    return false;
  }

  if (dimensionProperties.length > 0) {
    const dimensionsResult = await supabase
      .from("dataset_dimensions")
      .upsert(
        dimensionProperties.map((property) => ({
          dataset_id: datasetId,
          key: property.Key,
          title: property.Title || property.Key,
          type: property.Type || "Dimension",
          values_count: valueCounts.get(property.Key) ?? null,
          ingested_at: new Date().toISOString(),
        })),
        { onConflict: "dataset_id,key" }
      );

    if (dimensionsResult.error) {
      console.warn(`  skipped public dataset dimensions publish for ${datasetId}: ${dimensionsResult.error.message}`);
    }
  }

  return true;
}

async function getMaxIngestedRowIndex(supabase, datasetId) {
  const { data, error } = await supabase
    .schema("bronze")
    .from("cbs_typed_dataset_rows")
    .select("row_index")
    .eq("dataset_id", datasetId)
    .order("row_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data?.row_index === undefined || data?.row_index === null
    ? -1
    : Number(data.row_index);
}

async function getLoadedRowCount(supabase, datasetId) {
  const { count, error } = await supabase
    .schema("bronze")
    .from("cbs_typed_dataset_rows")
    .select("row_id", { count: "exact", head: true })
    .eq("dataset_id", datasetId);

  if (error) throw error;
  return count ?? 0;
}

async function shouldSkipDataset(supabase, table, options) {
  if (options.force || options.dryRun || options.failedOnly) return false;

  const { data, error } = await supabase
    .schema("bronze")
    .from("cbs_dataset_ingestion_status")
    .select("dataset_id,status,last_cbs_updated_at")
    .eq("dataset_id", table.Identifier)
    .maybeSingle();

  if (error) throw error;
  if (!data) return false;
  if (data.status !== "completed") return false;

  const previousUpdated = data.last_cbs_updated_at
    ? new Date(data.last_cbs_updated_at).toISOString()
    : null;

  const currentUpdated = table.Updated
    ? new Date(table.Updated).toISOString()
    : null;

  return previousUpdated === currentUpdated;
}

async function shouldIncludeFailedOnlyDataset(supabase, table, options) {
  if (!options.failedOnly || options.dryRun) return true;

  const { data, error } = await supabase
    .schema("bronze")
    .from("cbs_dataset_ingestion_status")
    .select("status")
    .eq("dataset_id", table.Identifier)
    .maybeSingle();

  if (error) throw error;

  return ["failed", "metadata_completed", "rows_partial"].includes(data?.status);
}

async function startRun(supabase, datasetId) {
  const { data, error } = await supabase
    .schema("bronze")
    .from("cbs_ingestion_runs")
    .insert({
      dataset_id: datasetId,
      status: "started",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

async function finishRun(supabase, runId, status, rowsIngested = 0, errorMessage = null) {
  const { error } = await supabase
    .schema("bronze")
    .from("cbs_ingestion_runs")
    .update({
      status,
      rows_ingested: rowsIngested,
      error_message: errorMessage,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) throw error;
}

async function updateDatasetStatus(
  supabase,
  table,
  recordCount,
  status,
  errorMessage = null,
  loadedRowCount = 0
) {
  const loadPercentage =
    recordCount && recordCount > 0
      ? Math.min(100, Number(((loadedRowCount / recordCount) * 100).toFixed(2)))
      : null;

  const { error } = await supabase
    .schema("bronze")
    .from("cbs_dataset_ingestion_status")
    .upsert(
      {
        dataset_id: table.Identifier,
        title: table.ShortTitle || table.Title,
        last_cbs_updated_at: table.Updated ?? null,
        last_ingested_at: new Date().toISOString(),
        record_count: recordCount,
        loaded_row_count: loadedRowCount,
        load_percentage: loadPercentage,
        status,
        error_message: errorMessage,
      },
      { onConflict: "dataset_id" }
    );

  if (error) throw error;
}

async function ingestTypedRows(supabase, datasetId, recordCount, options) {
  if (!options.includeRows) return 0;

  const maxRows =
    options.maxRowsPerDataset > 0
      ? Math.min(options.maxRowsPerDataset, recordCount ?? options.maxRowsPerDataset)
      : recordCount;

  if (!maxRows) return 0;

  let startSkip = 0;

  if (!options.dryRun && options.resumeRows && !options.force) {
    const maxIngestedRowIndex = await getMaxIngestedRowIndex(supabase, datasetId);
    startSkip = Math.max(0, maxIngestedRowIndex + 1);

    if (startSkip > 0) {
      console.log(`  resuming rows from offset ${startSkip} (${datasetId})`);
    }
  }

  if (startSkip >= maxRows) {
    console.log(`  rows already complete (${datasetId})`);
    return 0;
  }

  let written = 0;

  for (let skip = startSkip; skip < maxRows; skip += options.batchSize) {
    const top = Math.min(options.batchSize, maxRows - skip);
    const { url, payload, rows } = await getTypedRows(datasetId, skip, top, options);

    if (options.storeTypedBatchPayloads && !options.dryRun) {
      await upsertRawPayload(
        supabase,
        datasetId,
        `typed_dataset_batch:skip=${skip}:top=${top}`,
        url,
        payload
      );
    }

    if (rows.length === 0) break;

    if (!options.dryRun) {
      await upsertOrThrow(
        supabase,
        "bronze.cbs_typed_dataset_rows",
        typedDatasetRows(datasetId, rows, skip, url),
        { onConflict: "dataset_id,row_id" }
      );
    }

    written += rows.length;
    console.log(`  rows ${skip + rows.length}/${maxRows} (${datasetId})`);

    if (rows.length < top) break;
  }

  return written;
}

async function refreshPublicPreviewRows(supabase, datasetId, options) {
  if (options.dryRun) return;

  const { data, error } = await supabase
    .schema("bronze")
    .from("cbs_typed_dataset_rows")
    .select("dataset_id,row_id,row_index,raw,ingested_at")
    .eq("dataset_id", datasetId)
    .order("row_index", { ascending: true })
    .limit(25);

  if (error) throw error;

  const rows = data ?? [];
  if (rows.length === 0) return;

  const deleteResult = await supabase
    .from("dataset_preview_rows")
    .delete()
    .eq("dataset_id", datasetId);

  if (deleteResult.error) {
    console.warn(
      `  skipped public preview refresh for ${datasetId}: ${deleteResult.error.message}`
    );
    return;
  }

  const { error: upsertError } = await supabase
    .from("dataset_preview_rows")
    .upsert(rows, { onConflict: "dataset_id,row_id" });

  if (upsertError) {
    console.warn(
      `  skipped public preview refresh for ${datasetId}: ${upsertError.message}`
    );
    return;
  }

  console.log(`  refreshed public preview rows: ${rows.length} (${datasetId})`);
}

async function ingestTable(supabase, table, options) {
  const datasetId = table.Identifier;

  const dataPropertiesResult = await getDataPropertiesPayload(datasetId, options);
  const properties = dataPropertiesResult.payload.value ?? [];

  const dimensionProperties = properties.filter(
    (property) =>
      property.Key &&
      (property.Type?.includes("Dimension") || property.Type?.includes("Geo"))
  );

  const dimensionPayloads = [];

  for (const property of dimensionProperties) {
    const payloads = await getAllDimensionPayloads(datasetId, property.Key, options);
    dimensionPayloads.push(...payloads);
  }

  const recordCount = await getTypedDataSetCount(datasetId, options);

  if (options.dryRun) {
    console.log(
      JSON.stringify({
        datasetId,
        title: table.ShortTitle || table.Title,
        recordCount,
        rowsToIngest: options.includeRows
          ? options.maxRowsPerDataset > 0
            ? Math.min(options.maxRowsPerDataset, recordCount ?? 0)
            : recordCount
          : 0,
        rawPayloads: {
          catalogTable: 1,
          dataProperties: 1,
          dimensionPayloads: dimensionPayloads.length,
        },
      })
    );

    return {
      datasetId,
      recordCount,
      rowsIngested: 0,
    };
  }

  await upsertRawPayload(
    supabase,
    datasetId,
    "catalog_table",
    `${CBS_CATALOG_BASE}/Tables`,
    table
  );

  await upsertRawPayload(
    supabase,
    datasetId,
    "data_properties",
    dataPropertiesResult.url,
    dataPropertiesResult.payload
  );

  for (const dimension of dimensionPayloads) {
    await upsertRawPayload(
      supabase,
      datasetId,
      `dimension:${dimension.key}:skip=${dimension.skip}:top=${dimension.top}`,
      dimension.sourceUrl,
      dimension.payload
    );
  }

  await publishPublicDatasetMetadata(
    supabase,
    table,
    properties,
    dimensionPayloads,
    recordCount
  );

  await updateDatasetStatus(
    supabase,
    table,
    recordCount,
    "metadata_completed",
    null,
    await getLoadedRowCount(supabase, datasetId)
  );

  let writtenRows = 0;

  try {
    writtenRows = await ingestTypedRows(supabase, datasetId, recordCount, options);
    await refreshPublicPreviewRows(supabase, datasetId, options);
  } catch (error) {
    await updateDatasetStatus(
      supabase,
      table,
      recordCount,
      "rows_partial",
      error.message,
      await getLoadedRowCount(supabase, datasetId)
    );

    throw error;
  }

  const loadedRowCount = await getLoadedRowCount(supabase, datasetId);
  const finalStatus =
    recordCount !== null && recordCount !== undefined && loadedRowCount >= recordCount
      ? "completed"
      : loadedRowCount > 0
        ? "rows_partial"
        : "metadata_completed";

  await updateDatasetStatus(
    supabase,
    table,
    recordCount,
    finalStatus,
    null,
    loadedRowCount
  );

  console.log(
    `Ingested ${datasetId}: ${writtenRows} raw rows this run, ${loadedRowCount}/${recordCount ?? "unknown"} total raw rows loaded, ${properties.length} raw properties, ${dimensionPayloads.length} raw dimension payloads`
  );

  return {
    datasetId,
    recordCount,
    rowsIngested: writtenRows,
    loadedRowCount,
    finalStatus,
  };
}

async function main() {
  loadLocalEnv();

  const options = parseArgs(process.argv);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL.");
  }

  if (!options.dryRun && !serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Do not use the anon key for ingestion writes.");
  }

  const supabase = options.dryRun
    ? null
    : createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

  if (!options.dryRun) {
    await validateSupabaseTables(supabase);
  }

  const tables = await getCatalogTables(options);

  console.log(`Found ${tables.length} CBS table(s) to ingest raw.`);

  for (const table of tables) {
    const datasetId = table.Identifier;

    if (!options.dryRun && !(await shouldIncludeFailedOnlyDataset(supabase, table, options))) {
      console.log(`Skipped ${datasetId}: not failed or partial.`);
      continue;
    }

    if (!options.dryRun && await shouldSkipDataset(supabase, table, options)) {
      console.log(`Skipped ${datasetId}: already completed and CBS source has not changed.`);
      continue;
    }

    let lastError = null;

    for (let attempt = 1; attempt <= options.retries + 1; attempt += 1) {
      const runId = options.dryRun ? null : await startRun(supabase, datasetId);

      try {
        console.log(`Ingesting ${datasetId}, attempt ${attempt}/${options.retries + 1}`);

        const result = await ingestTable(supabase, table, options);

        if (!options.dryRun) {
          await finishRun(supabase, runId, result.finalStatus, result.rowsIngested);
          await updateDatasetStatus(
            supabase,
            table,
            result.recordCount,
            result.finalStatus,
            null,
            result.loadedRowCount
          );
        }

        lastError = null;
        break;
      } catch (error) {
        lastError = error;

        console.error(`Failed ${datasetId}, attempt ${attempt}:`, error.message);

        if (!options.dryRun && runId) {
          await finishRun(supabase, runId, "failed", 0, error.message);
          await updateDatasetStatus(
            supabase,
            table,
            null,
            "failed",
            error.message
          );
        }

        if (attempt <= options.retries) {
          await sleep(1000 * attempt);
        }
      }
    }

    if (lastError) {
      console.error(`Giving up on ${datasetId}: ${lastError.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
