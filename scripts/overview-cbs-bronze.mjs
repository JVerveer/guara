#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CBS_CATALOG_BASE = "https://opendata.cbs.nl/ODataCatalog";
const CBS_ODATA_BASE = "https://opendata.cbs.nl/ODataApi/odata";

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
    all: false,
    dataset: "",
    query: "",
    limit: 100,
    catalogPageSize: 100,
    withApiCounts: true,
    withLoadedCounts: true,
    concurrency: 4,
    requestTimeoutMs: 60000,
    output: "table",
    writeJson: false,
    jsonPath: "",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--all") options.all = true;
    else if (arg === "--dataset") options.dataset = argv[++i] ?? "";
    else if (arg === "--query") options.query = argv[++i] ?? "";
    else if (arg === "--limit") options.limit = Number(argv[++i] ?? options.limit);
    else if (arg === "--catalog-page-size") options.catalogPageSize = Number(argv[++i] ?? options.catalogPageSize);
    else if (arg === "--skip-api-counts") options.withApiCounts = false;
    else if (arg === "--skip-loaded-counts") options.withLoadedCounts = false;
    else if (arg === "--concurrency") options.concurrency = Number(argv[++i] ?? options.concurrency);
    else if (arg === "--request-timeout-ms") options.requestTimeoutMs = Number(argv[++i] ?? options.requestTimeoutMs);
    else if (arg === "--output") options.output = argv[++i] ?? options.output;
    else if (arg === "--write-json") options.writeJson = true;
    else if (arg === "--json-path") options.jsonPath = argv[++i] ?? "";
    else if (arg === "--help") {
      console.log(`Usage:
  npm run overview:cbs:bronze
  npm run overview:cbs:bronze -- --all
  npm run overview:cbs:bronze -- --query wijken --limit 50
  npm run overview:cbs:bronze -- --dataset 85039NED
  npm run overview:cbs:bronze -- --all --skip-api-counts
  npm run overview:cbs:bronze -- --all --write-json
  npm run overview:cbs:bronze -- --all --output json

Required env:
  VITE_SUPABASE_URL or SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Notes:
  Scans the CBS catalog and compares it with bronze.cbs_dataset_ingestion_status,
  bronze.cbs_catalog_tables, and bronze.cbs_typed_dataset_rows.

Options:
  --all                  Scan the full Dutch CBS catalog. Default scans --limit rows.
  --dataset 85039NED     Check one exact CBS table.
  --query term           Filter CBS catalog title/description/period.
  --limit 100            Catalog rows to scan when --all is not set.
  --skip-api-counts      Do not call TypedDataSet/$count for missing record counts.
  --skip-loaded-counts   Do not count rows in bronze.cbs_typed_dataset_rows.
  --concurrency 4        Parallel count requests.
  --output table|json    Console output format.
  --write-json           Write a timestamped JSON report to reports/.
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
    params.set(key, String(value));
  });

  return params.toString();
}

function escapeODataString(value) {
  return String(value).replace(/'/g, "''");
}

async function getJson(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} for ${url}${body ? `: ${body.slice(0, 300)}` : ""}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return results;
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
  if (options.dataset) return getCatalogTablesPage(options, 1, 0);
  if (!options.all) return getCatalogTablesPage(options, Math.max(1, options.limit), 0);

  const allTables = [];
  const top = Math.max(1, options.catalogPageSize);

  for (let skip = 0; ; skip += top) {
    const page = await getCatalogTablesPage(options, top, skip);
    allTables.push(...page);
    process.stderr.write(`\rCBS catalog scanned: ${allTables.length} table(s)`);
    if (page.length < top) break;
  }

  process.stderr.write("\n");
  return allTables;
}

async function getTypedDataSetCount(datasetId, options) {
  const url = `${CBS_ODATA_BASE}/${datasetId}/TypedDataSet/$count`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const count = Number(await response.text());
    return Number.isFinite(count) ? count : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getAllRows(supabase, schema, table, select) {
  const rows = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .schema(schema)
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

function isMissingTableError(error) {
  return error?.code === "PGRST205" || error?.message?.includes("Could not find the table");
}

async function getOptionalAllRows(supabase, schema, table, select) {
  try {
    return await getAllRows(supabase, schema, table, select);
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
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

async function getStatusRows(supabase) {
  try {
    return await getAllRows(
      supabase,
      "bronze",
      "cbs_dataset_ingestion_status",
      "dataset_id,title,last_cbs_updated_at,last_ingested_at,record_count,loaded_row_count,load_percentage,status,error_message"
    );
  } catch (error) {
    if (error?.code !== "42703") throw error;
    return getAllRows(
      supabase,
      "bronze",
      "cbs_dataset_ingestion_status",
      "dataset_id,title,last_cbs_updated_at,last_ingested_at,record_count,status,error_message"
    );
  }
}

function classifyLoad({ status, loadedRows, recordCount, metadataLoaded }) {
  if (!metadataLoaded && loadedRows === 0) return "not_loaded";
  if (metadataLoaded && loadedRows === 0) return status === "failed" ? "failed_metadata" : "metadata_only";
  if (recordCount === null || recordCount === undefined) {
    return status === "rows_partial" ? "partial_unknown_total" : "rows_loaded_unknown_total";
  }
  if (loadedRows >= recordCount) return "complete";
  if (loadedRows > 0 && loadedRows < recordCount) return "partial";
  return status ?? "unknown";
}

function loadPercentage(loadedRows, recordCount) {
  if (!recordCount || recordCount <= 0) return null;
  return Math.min(100, Number(((loadedRows / recordCount) * 100).toFixed(2)));
}

function summarize(rows) {
  const byStatus = rows.reduce((acc, row) => {
    acc[row.loadClassification] = (acc[row.loadClassification] ?? 0) + 1;
    return acc;
  }, {});

  return {
    apiTablesScanned: rows.length,
    bronzeMetadataLoaded: rows.filter((row) => row.bronzeMetadataLoaded).length,
    bronzeRowsLoaded: rows.filter((row) => row.loadedRows > 0).length,
    complete: rows.filter((row) => row.loadClassification === "complete").length,
    partial: rows.filter((row) => row.loadClassification.includes("partial")).length,
    metadataOnly: rows.filter((row) => row.loadClassification === "metadata_only").length,
    notLoaded: rows.filter((row) => row.loadClassification === "not_loaded").length,
    byStatus,
  };
}

function compactTable(rows) {
  return rows.map((row) => ({
    id: row.datasetId,
    title: row.title.slice(0, 56),
    apiRecords: row.recordCount ?? "unknown",
    loadedRows: row.loadedRows,
    pct: row.loadPercentage ?? "unknown",
    status: row.loadClassification,
    bronzeStatus: row.bronzeStatus ?? "",
    updated: row.cbsUpdatedAt ?? "",
  }));
}

function writeJsonReport(report, options) {
  const directory = resolve(process.cwd(), "reports");
  mkdirSync(directory, { recursive: true });
  const filename =
    options.jsonPath ||
    resolve(directory, `cbs-bronze-overview-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

  writeFileSync(filename, `${JSON.stringify(report, null, 2)}\n`);
  return filename;
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL.");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const [catalogTables, bronzeCatalogRows, statusRows] = await Promise.all([
    getCatalogTables(options),
    getOptionalAllRows(supabase, "bronze", "cbs_catalog_tables", "identifier,ingested_at"),
    getStatusRows(supabase),
  ]);
  const rawCatalogPayloadRows = await getOptionalAllRows(
    supabase,
    "bronze",
    "cbs_raw_endpoint_payloads",
    "dataset_id,endpoint,ingested_at"
  );

  const bronzeCatalogById = new Map(bronzeCatalogRows.map((row) => [row.identifier, row]));
  const rawCatalogById = new Map(
    rawCatalogPayloadRows
      .filter((row) => row.endpoint === "catalog_table")
      .map((row) => [row.dataset_id, row])
  );
  const statusById = new Map(statusRows.map((row) => [row.dataset_id, row]));

  const baseRows = catalogTables.map((table) => {
    const status = statusById.get(table.Identifier);
    const bronzeCatalog = bronzeCatalogById.get(table.Identifier);
    const rawCatalog = rawCatalogById.get(table.Identifier);
    return {
      datasetId: table.Identifier,
      title: table.ShortTitle || table.Title,
      description: table.ShortDescription ?? "",
      language: table.Language ?? null,
      catalog: table.Catalog ?? null,
      period: table.Period ?? null,
      cbsUpdatedAt: table.Updated ?? null,
      recordCount: status?.record_count ?? null,
      storedLoadedRows: status?.loaded_row_count ?? null,
      storedLoadPercentage: status?.load_percentage ?? null,
      bronzeMetadataLoaded: Boolean(status || bronzeCatalog || rawCatalog),
      bronzeCatalogIngestedAt: bronzeCatalog?.ingested_at ?? rawCatalog?.ingested_at ?? null,
      bronzeLastIngestedAt: status?.last_ingested_at ?? null,
      bronzeStatus: status?.status ?? null,
      bronzeError: status?.error_message ?? null,
    };
  });

  const rowsWithApiCounts = options.withApiCounts
    ? await mapWithConcurrency(baseRows, options.concurrency, async (row) => ({
        ...row,
        recordCount: row.recordCount ?? (await getTypedDataSetCount(row.datasetId, options)),
      }))
    : baseRows;

  const rowsWithLoadedCounts = options.withLoadedCounts
    ? await mapWithConcurrency(rowsWithApiCounts, options.concurrency, async (row) => ({
        ...row,
        loadedRows: row.bronzeMetadataLoaded ? await getLoadedRowCount(supabase, row.datasetId) : 0,
      }))
    : rowsWithApiCounts.map((row) => ({ ...row, loadedRows: row.storedLoadedRows ?? 0 }));

  const rows = rowsWithLoadedCounts.map((row) => {
    const loadClassification = classifyLoad({
      status: row.bronzeStatus,
      loadedRows: row.loadedRows,
      recordCount: row.recordCount,
      metadataLoaded: row.bronzeMetadataLoaded,
    });

    return {
      ...row,
      loadClassification,
      loadPercentage: loadPercentage(row.loadedRows, row.recordCount),
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    scope: {
      all: options.all,
      dataset: options.dataset || null,
      query: options.query || null,
      limit: options.all ? null : options.limit,
      withApiCounts: options.withApiCounts,
      withLoadedCounts: options.withLoadedCounts,
    },
    summary: summarize(rows),
    rows,
  };

  if (options.output === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("\nBronze CBS overview");
    console.log(JSON.stringify(report.summary, null, 2));
    console.table(compactTable(rows));
  }

  if (options.writeJson) {
    const path = writeJsonReport(report, options);
    console.log(`Wrote JSON report: ${path}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
