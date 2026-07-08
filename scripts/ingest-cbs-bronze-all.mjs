#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CBS_ODATA_BASE = "https://opendata.cbs.nl/ODataApi/odata";
const CBS_ODATA_FEED_BASE = "https://opendata.cbs.nl/ODataFeed/odata";
const CBS_CATALOG_BASE = "https://opendata.cbs.nl/ODataCatalog";

const REQUIRED_BRONZE_TABLES = [
  "cbs_raw_endpoint_payloads",
  "cbs_typed_dataset_rows",
  "cbs_ingestion_runs",
  "cbs_dataset_ingestion_status",
  "cbs_schema_snapshots",
];

const STATUS = {
  PENDING: "pending",
  METADATA_LOADED: "metadata_loaded",
  PARTIAL: "partial",
  COMPLETE: "complete",
  COMPLETE_WITH_WARNINGS: "complete_with_warnings",
  FAILED: "failed",
  SKIPPED: "skipped",
  STALE: "stale",
};

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
    batchSize: 2000,
    maxRowsPerDataset: 0,
    dimensionBatchSize: 5000,
    includeRows: true,
    dryRun: false,
    retries: 2,
    force: false,
    requestDelayMs: 100,
    requestTimeoutMs: 60000,
    resumeRows: true,
    storeTypedBatchPayloads: false,
    exactCounts: false,
    overview: false,
    output: "table",
    writeJson: false,
    jsonPath: "",
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
    else if (arg === "--store-typed-batch-payloads") options.storeTypedBatchPayloads = true;
    else if (arg === "--exact-counts") options.exactCounts = true;
    else if (arg === "overview" || arg === "--overview") options.overview = true;
    else if (arg === "--output") options.output = argv[++i] ?? options.output;
    else if (arg === "--write-json") options.writeJson = true;
    else if (arg === "--json-path") options.jsonPath = argv[++i] ?? "";
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
  --batch-size 2000                TypedDataSet row batch size.
  --dimension-batch-size 5000      Dimension values batch size.
  --no-resume-rows                 Disable row-level resume.
  --store-typed-batch-payloads     Also store every TypedDataSet batch response in raw endpoint payloads.
  --exact-counts                   Use exact row counts in overview mode. Slower on large Bronze tables.
  --overview                       Scan CBS catalog and compare against Bronze status.
  --output table|json              Console output for overview mode.
  --write-json                     Write overview report to reports/.
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

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function schemaHash(properties) {
  const schema = properties
    .map((property) => ({
      id: property.ID,
      key: property.Key,
      title: property.Title,
      type: property.Type,
      datatype: property.Datatype,
      unit: property.Unit,
      position: property.Position,
      parentId: property.ParentID,
    }))
    .sort((a, b) => String(a.key ?? a.id).localeCompare(String(b.key ?? b.id)));

  return createHash("sha256").update(stableJson(schema)).digest("hex");
}

function pct(part, total) {
  if (!total || total <= 0) return null;
  return Math.min(100, Number(((part / total) * 100).toFixed(2)));
}

function bronzeQualityChecks({ properties, dimensionPayloads, recordCount, loadedRowCount, finalStatus }) {
  const dimensionProperties = properties.filter((property) => property.Key && (property.Type?.includes("Dimension") || property.Type?.includes("Geo") || property.Type === "TimeDimension"));
  const dimensionPayloadKeys = new Set(dimensionPayloads.map((dimension) => dimension.key));
  const missingDimensions = dimensionProperties.filter((property) => !dimensionPayloadKeys.has(property.Key)).map((property) => property.Key);
  const checks = {
    metadata_present: { status: properties.length > 0 ? "pass" : "fail", actual: properties.length },
    dimensions_loaded: { status: missingDimensions.length === 0 ? "pass" : "warn", missing: missingDimensions },
    rows_match_expected: {
      status: recordCount === null || recordCount === undefined ? "warn" : loadedRowCount >= recordCount ? "pass" : loadedRowCount > 0 ? "warn" : "fail",
      expected: recordCount,
      actual: loadedRowCount,
    },
    status_terminal: { status: [STATUS.COMPLETE, STATUS.PARTIAL, STATUS.METADATA_LOADED].includes(finalStatus) ? "pass" : "warn", actual: finalStatus },
  };
  const failed = Object.values(checks).some((check) => check.status === "fail");
  const warned = Object.values(checks).some((check) => check.status === "warn");
  return {
    checks,
    qualityStatus: failed ? "failed" : warned ? "warning" : "passed",
    metadataCompletenessPct: properties.length > 0 ? 100 : 0,
    dimensionCompletenessPct: dimensionProperties.length === 0 ? 100 : pct(dimensionProperties.length - missingDimensions.length, dimensionProperties.length),
    rowCompletenessPct: pct(loadedRowCount, recordCount),
  };
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

async function validateSupabaseTables(supabase, requiredTables = REQUIRED_BRONZE_TABLES) {
  for (const table of requiredTables) {
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
  const seenPageSignatures = new Set();

  for (let skip = 0; ; skip += top) {
    const result = await getDimensionValuesPayload(datasetId, dimensionKey, skip, top, options);
    const values = result.payload.value ?? [];
    const firstKey = values[0]?.Key ?? "";
    const lastKey = values.at(-1)?.Key ?? "";
    const pageSignature = `${values.length}:${firstKey}:${lastKey}`;

    payloads.push({
      key: dimensionKey,
      skip,
      top,
      sourceUrl: result.url,
      payload: result.payload,
      count: values.length,
    });

    if (skip === 0 && values.length > top) {
      console.log(
        `  dimension ${dimensionKey}: ${values.length} values returned in a single unpaged response (${datasetId})`
      );
      break;
    }

    if (seenPageSignatures.has(pageSignature)) {
      console.log(
        `  dimension ${dimensionKey}: stopped paging after repeated response at skip ${skip} (${datasetId})`
      );
      break;
    }

    seenPageSignatures.add(pageSignature);

    if (!result.payload["odata.nextLink"] && !result.payload["@odata.nextLink"]) break;
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

function typedDatasetRows(datasetId, rows, skip, sourceUrl, runId, sourceVersion) {
  const now = new Date().toISOString();

  return rows.map((row, index) => {
    const rowIndex = skip + index;

    return {
      dataset_id: datasetId,
      row_id: row.ID === undefined || row.ID === null ? String(rowIndex) : String(row.ID),
      row_index: rowIndex,
      ingestion_run_id: runId,
      source_version: sourceVersion,
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

async function publishSchemaSnapshot(supabase, datasetId, sourceVersion, properties) {
  if (!sourceVersion || properties.length === 0) return null;
  const hash = schemaHash(properties);
  const { error } = await supabase
    .schema("bronze")
    .from("cbs_schema_snapshots")
    .upsert(
      {
        dataset_id: datasetId,
        source_version: sourceVersion,
        schema_hash: hash,
        properties,
        captured_at: new Date().toISOString(),
      },
      { onConflict: "dataset_id,source_version,schema_hash" }
    );
  if (error) throw error;
  return hash;
}

async function publishPublicQualityChecks(supabase, datasetId, layer, quality) {
  const rows = Object.entries(quality.checks).map(([checkName, check]) => ({
    dataset_id: datasetId,
    layer,
    check_name: checkName,
    status: check.status,
    expected_value: check.expected === undefined ? null : String(check.expected),
    actual_value: check.actual === undefined ? null : String(check.actual),
    message: check.missing?.length ? `Missing: ${check.missing.join(", ")}` : null,
    checked_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("dataset_quality_checks")
    .upsert(rows, { onConflict: "dataset_id,layer,check_name" });

  if (error) {
    console.warn(`  skipped public quality checks for ${datasetId}: ${error.message}`);
  }
}

async function publishSourceLayerSummary(supabase, layer) {
  if (layer !== "bronze") return;
  const { data, error } = await supabase
    .schema("bronze")
    .from("cbs_dataset_ingestion_status")
    .select("dataset_id,status,record_count,loaded_row_count,error_message,last_ingested_at,quality_status");
  if (error) throw error;

  const rows = data ?? [];
  const recordsExpected = rows.reduce((sum, row) => sum + (row.record_count ?? 0), 0);
  const recordsLoaded = rows.reduce((sum, row) => sum + (row.loaded_row_count ?? 0), 0);
  const failed = rows.filter((row) => row.status === STATUS.FAILED || row.error_message).length;
  const partial = rows.filter((row) => row.status === STATUS.PARTIAL).length;
  const complete = rows.filter((row) => row.status === STATUS.COMPLETE || row.status === STATUS.COMPLETE_WITH_WARNINGS).length;
  const lastLoadedAt = rows.map((row) => row.last_ingested_at).filter(Boolean).sort().at(-1) ?? null;
  const summaryStatus = failed > 0 ? STATUS.COMPLETE_WITH_WARNINGS : partial > 0 ? STATUS.PARTIAL : complete > 0 ? STATUS.COMPLETE : STATUS.PENDING;

  const { error: summaryError } = await supabase
    .from("source_layer_summary")
    .upsert(
      {
        provider: "CBS",
        layer,
        status: summaryStatus,
        datasets_total: rows.length,
        datasets_complete: complete,
        datasets_partial: partial,
        datasets_failed: failed,
        records_expected: recordsExpected,
        records_loaded: recordsLoaded,
        completeness_pct: pct(recordsLoaded, recordsExpected),
        rejected_rows: 0,
        last_loaded_at: lastLoadedAt,
        metadata: { quality_statuses: rows.reduce((acc, row) => ({ ...acc, [row.quality_status ?? "unknown"]: (acc[row.quality_status ?? "unknown"] ?? 0) + 1 }), {}) },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,layer" }
    );

  if (summaryError) console.warn(`  skipped source layer summary for ${layer}: ${summaryError.message}`);
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

async function getLoadedRowCountEstimate(supabase, datasetId) {
  const maxIngestedRowIndex = await getMaxIngestedRowIndex(supabase, datasetId);
  return maxIngestedRowIndex < 0 ? 0 : maxIngestedRowIndex + 1;
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
  if (![STATUS.COMPLETE, STATUS.COMPLETE_WITH_WARNINGS, "completed"].includes(data.status)) return false;

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

  return [
    STATUS.FAILED,
    STATUS.METADATA_LOADED,
    STATUS.PARTIAL,
    "metadata_completed",
    "rows_partial",
  ].includes(data?.status);
}

async function startRun(supabase, datasetId, sourceVersion = null, expectedRows = null) {
  const { data, error } = await supabase
    .schema("bronze")
    .from("cbs_ingestion_runs")
    .insert({
      dataset_id: datasetId,
      status: STATUS.PENDING,
      source_version: sourceVersion,
      expected_rows: expectedRows,
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
  loadedRowCount = 0,
  options = {}
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
        source_version: options.sourceVersion ?? table.Updated ?? null,
        schema_hash: options.schemaHash ?? null,
        last_run_id: options.runId ?? null,
        metadata_completeness_pct: options.metadataCompletenessPct ?? null,
        dimension_completeness_pct: options.dimensionCompletenessPct ?? null,
        row_completeness_pct: options.rowCompletenessPct ?? loadPercentage,
        quality_status: options.qualityStatus ?? null,
        quality_checks: options.qualityChecks ?? {},
        status,
        error_message: errorMessage,
      },
      { onConflict: "dataset_id" }
    );

  if (error) throw error;
}

async function ingestTypedRows(supabase, datasetId, recordCount, options, runId, sourceVersion) {
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
        typedDatasetRows(datasetId, rows, skip, url, runId, sourceVersion),
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

async function ingestTable(supabase, table, options, runId = null) {
  const datasetId = table.Identifier;
  const sourceVersion = table.Updated ?? null;

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
  const schemaHashValue = options.dryRun ? null : await publishSchemaSnapshot(supabase, datasetId, sourceVersion, properties);

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
    STATUS.METADATA_LOADED,
    null,
    await getLoadedRowCountEstimate(supabase, datasetId),
    {
      runId,
      sourceVersion,
      schemaHash: schemaHashValue,
      metadataCompletenessPct: properties.length > 0 ? 100 : 0,
      dimensionCompletenessPct: dimensionProperties.length > 0 ? pct(dimensionPayloads.length, dimensionProperties.length) : 100,
      rowCompletenessPct: pct(await getLoadedRowCountEstimate(supabase, datasetId), recordCount),
      qualityStatus: "pending",
      qualityChecks: {},
    }
  );

  let writtenRows = 0;

  try {
    writtenRows = await ingestTypedRows(supabase, datasetId, recordCount, options, runId, sourceVersion);
    await refreshPublicPreviewRows(supabase, datasetId, options);
  } catch (error) {
    await updateDatasetStatus(
      supabase,
      table,
      recordCount,
      STATUS.PARTIAL,
      error.message,
      await getLoadedRowCountEstimate(supabase, datasetId),
      {
        runId,
        sourceVersion,
        schemaHash: schemaHashValue,
        qualityStatus: "warning",
      }
    );

    throw error;
  }

  const loadedRowCount = await getLoadedRowCountEstimate(supabase, datasetId);
  const finalStatus =
    recordCount !== null && recordCount !== undefined && loadedRowCount >= recordCount
      ? STATUS.COMPLETE
      : loadedRowCount > 0
        ? STATUS.PARTIAL
        : STATUS.METADATA_LOADED;
  const quality = bronzeQualityChecks({ properties, dimensionPayloads, recordCount, loadedRowCount, finalStatus });

  await updateDatasetStatus(
    supabase,
    table,
    recordCount,
    finalStatus,
    null,
    loadedRowCount,
    {
      runId,
      sourceVersion,
      schemaHash: schemaHashValue,
      metadataCompletenessPct: quality.metadataCompletenessPct,
      dimensionCompletenessPct: quality.dimensionCompletenessPct,
      rowCompletenessPct: quality.rowCompletenessPct,
      qualityStatus: quality.qualityStatus,
      qualityChecks: quality.checks,
    }
  );
  await publishPublicQualityChecks(supabase, datasetId, "bronze", quality);
  await publishSourceLayerSummary(supabase, "bronze");

  console.log(
    `Ingested ${datasetId}: ${writtenRows} raw rows this run, ${loadedRowCount}/${recordCount ?? "unknown"} total raw rows loaded, ${properties.length} raw properties, ${dimensionPayloads.length} raw dimension payloads`
  );

  return {
    datasetId,
    recordCount,
    rowsIngested: writtenRows,
    loadedRowCount,
    finalStatus,
    sourceVersion,
    schemaHash: schemaHashValue,
    quality,
  };
}

async function getOverviewRows(queryFactory, pageSize = 1000) {
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

async function getExactBronzeRowCount(supabase, datasetId) {
  const { count, error } = await supabase
    .schema("bronze")
    .from("cbs_typed_dataset_rows")
    .select("row_id", { count: "exact", head: true })
    .eq("dataset_id", datasetId);

  if (error) throw error;
  return count ?? 0;
}

function classifyBronzeOverview(row) {
  if ([STATUS.COMPLETE, STATUS.COMPLETE_WITH_WARNINGS, "completed"].includes(row.status) || row.loadedRows >= row.apiRecords) return "complete";
  if (row.status === STATUS.FAILED) return "failed";
  if (row.loadedRows > 0) return "partial";
  if (row.status === STATUS.METADATA_LOADED || row.status === "metadata_completed") return "metadata_only";
  return "not_loaded";
}

function compactBronzeOverviewTable(rows) {
  return rows.map((row) => ({
    id: row.datasetId,
    title: row.title.slice(0, 52),
    apiRecords: row.apiRecords ?? "unknown",
    loadedRows: row.loadedRows,
    pctLoaded: row.loadPercentage ?? "unknown",
    status: row.classification,
    bronzeStatus: row.status ?? "",
  }));
}

function writeBronzeOverviewJson(report, options) {
  const directory = resolve(process.cwd(), "reports");
  mkdirSync(directory, { recursive: true });
  const filename =
    options.jsonPath ||
    resolve(directory, `cbs-bronze-overview-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

  writeFileSync(filename, `${JSON.stringify(report, null, 2)}\n`);
  return filename;
}

async function runBronzeOverview(supabase, options) {
  const [tables, statusRows] = await Promise.all([
    getCatalogTables(options),
    getOverviewRows(() =>
      supabase
        .schema("bronze")
        .from("cbs_dataset_ingestion_status")
        .select("dataset_id,title,record_count,loaded_row_count,load_percentage,status,error_message,last_ingested_at")
    ),
  ]);
  const statusById = new Map(statusRows.map((row) => [row.dataset_id, row]));

  const rows = [];

  for (const table of tables) {
    const status = statusById.get(table.Identifier);
    const loadedRows = options.exactCounts && status
      ? await getExactBronzeRowCount(supabase, table.Identifier)
      : status?.loaded_row_count ?? 0;
    const row = {
      datasetId: table.Identifier,
      title: table.ShortTitle || table.Title || table.Identifier,
      description: table.ShortDescription ?? "",
      period: table.Period ?? null,
      cbsUpdatedAt: table.Updated ?? null,
      apiRecords: status?.record_count ?? null,
      loadedRows,
      loadPercentage: pct(loadedRows, status?.record_count),
      status: status?.status ?? null,
      error: status?.error_message ?? null,
      lastIngestedAt: status?.last_ingested_at ?? null,
    };
    rows.push({ ...row, classification: classifyBronzeOverview(row) });
  }

  const summary = {
    datasetsScanned: rows.length,
    complete: rows.filter((row) => row.classification === "complete").length,
    partial: rows.filter((row) => row.classification === "partial").length,
    metadataOnly: rows.filter((row) => row.classification === "metadata_only").length,
    notLoaded: rows.filter((row) => row.classification === "not_loaded").length,
    failed: rows.filter((row) => row.classification === "failed").length,
    rowsLoaded: rows.reduce((sum, row) => sum + row.loadedRows, 0),
    recordsExpected: rows.reduce((sum, row) => sum + (row.apiRecords ?? 0), 0),
  };
  const report = {
    generatedAt: new Date().toISOString(),
    scope: {
      dataset: options.dataset || null,
      query: options.query || null,
      limit: options.limit,
      all: options.all,
    },
    summary,
    rows,
  };

  if (options.output === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("\nBronze CBS overview");
    console.log(JSON.stringify(report.summary, null, 2));
    console.table(compactBronzeOverviewTable(rows));
  }

  if (options.writeJson) {
    const path = writeBronzeOverviewJson(report, options);
    console.log(`Wrote JSON report: ${path}`);
  }
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
    const requiredTables = options.overview
      ? REQUIRED_BRONZE_TABLES.filter((table) => table !== "cbs_schema_snapshots")
      : REQUIRED_BRONZE_TABLES;
    await validateSupabaseTables(supabase, requiredTables);
  }

  if (options.overview) {
    await runBronzeOverview(supabase, options);
    return;
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
      const runId = options.dryRun ? null : await startRun(supabase, datasetId, table.Updated ?? null, null);

      try {
        console.log(`Ingesting ${datasetId}, attempt ${attempt}/${options.retries + 1}`);

        const result = await ingestTable(supabase, table, options, runId);

        if (!options.dryRun) {
          await finishRun(supabase, runId, result.finalStatus, result.rowsIngested);
          await updateDatasetStatus(
            supabase,
            table,
            result.recordCount,
            result.finalStatus,
            null,
            result.loadedRowCount,
            {
              runId,
              sourceVersion: result.sourceVersion,
              schemaHash: result.schemaHash,
              metadataCompletenessPct: result.quality?.metadataCompletenessPct,
              dimensionCompletenessPct: result.quality?.dimensionCompletenessPct,
              rowCompletenessPct: result.quality?.rowCompletenessPct,
              qualityStatus: result.quality?.qualityStatus,
              qualityChecks: result.quality?.checks,
            }
          );
        }

        lastError = null;
        break;
      } catch (error) {
        lastError = error;

        console.error(`Failed ${datasetId}, attempt ${attempt}:`, error.message);

        if (!options.dryRun && runId) {
          await finishRun(supabase, runId, STATUS.FAILED, 0, error.message);
          await updateDatasetStatus(
            supabase,
            table,
            null,
            STATUS.FAILED,
            error.message,
            0,
            { runId, sourceVersion: table.Updated ?? null, qualityStatus: "failed" }
          );
          await publishSourceLayerSummary(supabase, "bronze").catch(() => {});
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
