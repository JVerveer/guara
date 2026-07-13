#!/usr/bin/env node
import pg from "pg";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const { Client } = pg;

const CBS_ODATA_BASE = "https://opendata.cbs.nl/ODataApi/odata";
const CBS_ODATA_FEED_BASE = "https://opendata.cbs.nl/ODataFeed/odata";
const CBS_CATALOG_BASE = "https://opendata.cbs.nl/ODataCatalog";

const STATUS = {
  PENDING: "pending",
  METADATA_LOADED: "metadata_loaded",
  PARTIAL: "partial",
  COMPLETE: "complete",
  FAILED: "failed",
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
    includeArchive: false,
    tableOffset: 0,
    catalogPageSize: 100,
    batchSize: 5000,
    upsertBatchSize: 500,
    maxRowsPerDataset: 0,
    requestDelayMs: 50,
    requestTimeoutMs: 60000,
    writeTimeoutMs: 120000,
    retries: 2,
    force: false,
    resumeRows: true,
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dataset") options.dataset = argv[++i] ?? "";
    else if (arg === "--query") options.query = argv[++i] ?? "";
    else if (arg === "--limit") options.limit = Number(argv[++i] ?? options.limit);
    else if (arg === "--all") options.all = true;
    else if (arg === "--failed-only") options.failedOnly = true;
    else if (arg === "--include-archive" || arg === "--include-archief") options.includeArchive = true;
    else if (arg === "--large-chunks") {
      options.batchSize = 10000;
      options.upsertBatchSize = 1000;
      options.requestTimeoutMs = Math.max(options.requestTimeoutMs, 120000);
      options.writeTimeoutMs = Math.max(options.writeTimeoutMs, 180000);
    }
    else if (arg === "--huge-chunks") {
      options.batchSize = 20000;
      options.upsertBatchSize = 1000;
      options.requestTimeoutMs = Math.max(options.requestTimeoutMs, 180000);
      options.writeTimeoutMs = Math.max(options.writeTimeoutMs, 240000);
    }
    else if (arg === "--wide-table-chunks") {
      options.batchSize = 2500;
      options.upsertBatchSize = 250;
      options.requestTimeoutMs = Math.max(options.requestTimeoutMs, 120000);
      options.writeTimeoutMs = Math.max(options.writeTimeoutMs, 120000);
    }
    else if (arg === "--table-offset") options.tableOffset = Number(argv[++i] ?? options.tableOffset);
    else if (arg === "--catalog-page-size") options.catalogPageSize = Number(argv[++i] ?? options.catalogPageSize);
    else if (arg === "--batch-size") options.batchSize = Number(argv[++i] ?? options.batchSize);
    else if (arg === "--upsert-batch-size") options.upsertBatchSize = Number(argv[++i] ?? 0);
    else if (arg === "--max-rows-per-dataset") options.maxRowsPerDataset = Number(argv[++i] ?? 0);
    else if (arg === "--request-delay-ms") options.requestDelayMs = Number(argv[++i] ?? options.requestDelayMs);
    else if (arg === "--request-timeout-ms") options.requestTimeoutMs = Number(argv[++i] ?? options.requestTimeoutMs);
    else if (arg === "--write-timeout-ms") options.writeTimeoutMs = Number(argv[++i] ?? options.writeTimeoutMs);
    else if (arg === "--retries") options.retries = Number(argv[++i] ?? options.retries);
    else if (arg === "--force") options.force = true;
    else if (arg === "--no-resume-rows") options.resumeRows = false;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--help") {
      console.log(`Usage:
  npm run ingest:cbs:bronze:fast -- --dataset 85039NED
  npm run ingest:cbs:bronze:fast -- --query wonen --limit 10 --max-rows-per-dataset 100000
  npm run ingest:cbs:bronze:fast -- --failed-only --limit 25

Required env:
  SUPABASE_DB_URL

Recommended flow:
  1. Run normal Bronze metadata/classification first.
  2. Use this fast path for raw TypedDataSet rows.

Options:
  --dataset 85039NED              Ingest one dataset.
  --query wonen                   Search CBS catalog title/description/period.
  --limit 10                      Number of catalog tables when not using --all.
  --all                           Page through the full Dutch CBS catalog.
  --failed-only                   Only process failed/partial/metadata-only Bronze statuses.
  --include-archive               Include CBS root theme Archief. Excluded by default.
  --large-chunks                  Preset: --batch-size 10000 --upsert-batch-size 1000.
  --huge-chunks                   Preset: --batch-size 20000 --upsert-batch-size 1000.
  --wide-table-chunks             Preset: --batch-size 2500 --upsert-batch-size 250.
  --force                         Delete existing Bronze rows for the dataset before loading.
  --batch-size 5000               CBS fetch and Postgres merge batch size.
  --upsert-batch-size 500         Postgres staging/merge chunk size after each CBS fetch.
  --max-rows-per-dataset 100000   Cap row loading per dataset.
  --write-timeout-ms 120000       Timeout for each Postgres write chunk.
  --no-resume-rows                Start from row offset 0.
  --dry-run                       Fetch counts and plan without writing.
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url, options) {
  if (options.requestDelayMs > 0) await sleep(options.requestDelayMs);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} for ${url}${body ? `: ${body.slice(0, 300)}` : ""}`);
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

async function getText(url, options) {
  if (options.requestDelayMs > 0) await sleep(options.requestDelayMs);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function getCatalogTablesPage(options, top, skip) {
  const select = "ID,Identifier,Title,ShortTitle,ShortDescription,Updated,Period,Language,Catalog";

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
    $orderby: "ID asc",
    $top: top,
    $skip: skip,
  })}`;

  const payload = await getJson(url, options);
  return payload.value ?? [];
}

async function getCatalogTables(options) {
  if (options.dataset) return getCatalogTablesPage(options, 1, 0);
  if (!options.all) {
    return getCatalogTablesPage(options, Math.max(1, options.limit), Math.max(0, options.tableOffset));
  }

  const tables = [];
  let skip = Math.max(0, options.tableOffset);
  const top = Math.max(1, options.catalogPageSize);

  while (true) {
    const page = await getCatalogTablesPage(options, top, skip);
    tables.push(...page);
    console.log(`Catalog discovery: ${tables.length} table(s) loaded`);
    if (page.length < top) break;
    skip += top;
  }

  return tables;
}

async function getTypedDataSetCount(datasetId, options) {
  const text = await getText(`${CBS_ODATA_BASE}/${datasetId}/TypedDataSet/$count`, options);
  const count = Number(text);
  return Number.isFinite(count) ? count : null;
}

async function getTypedRows(datasetId, skip, top, options) {
  const url = `${CBS_ODATA_FEED_BASE}/${datasetId}/TypedDataSet?${buildQuery({
    $top: top,
    $skip: skip,
  })}`;
  const payload = await getJson(url, options);
  return payload.value ?? [];
}

function pct(part, total) {
  if (!total || total <= 0) return null;
  return Math.min(100, Number(((part / total) * 100).toFixed(2)));
}

function postgresClient(options) {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error("Missing SUPABASE_DB_URL in .env.local.");

  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslcert");
  url.searchParams.delete("sslkey");
  url.searchParams.delete("sslrootcert");
  url.searchParams.delete("uselibpqcompat");
  url.searchParams.set("application_name", "guara-cbs-bronze-fast");

  return new Client({
    connectionString: url.toString(),
    ssl: process.env.SUPABASE_DB_SSL_DISABLE === "true" ? false : { rejectUnauthorized: false },
    statement_timeout: Math.max(1, options.writeTimeoutMs),
    query_timeout: Math.max(1, options.writeTimeoutMs),
  });
}

function explainPostgresConnectionError(error) {
  if (error?.code === "ENOTFOUND" && String(error.hostname ?? "").startsWith("db.")) {
    return [
      error.message,
      "",
      "The direct Supabase database hostname could not be resolved by DNS.",
      "Use the Session pooler connection string from Supabase instead:",
      "  Supabase project -> Connect -> Session pooler -> URI",
      "",
      "It usually looks like:",
      "  postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require",
      "",
      "Put that URI in .env.local as SUPABASE_DB_URL.",
    ].join("\n");
  }

  if (error?.code === "ENETUNREACH" || error?.code === "EHOSTUNREACH") {
    return [
      error.message,
      "",
      "The direct Supabase database endpoint is probably not reachable from this network.",
      "Use the Session pooler connection string from Supabase Connect instead of the direct db.<project-ref>.supabase.co host.",
    ].join("\n");
  }

  if (error?.code === "28P01" || String(error?.message ?? "").includes("password authentication failed")) {
    return [
      error.message,
      "",
      "Postgres rejected the credentials in SUPABASE_DB_URL.",
      "For Supabase Session pooler, the username usually includes the project ref:",
      "  postgres.<project-ref>",
      "",
      "For this project that should look like:",
      "  postgres.kmwmbmpnipwygkvnqeai",
      "",
      "Also check that the database password is correct and URL-encoded if it contains special characters like @, #, %, /, :, ?, &, +, or spaces.",
    ].join("\n");
  }

  if (String(error?.message ?? "").includes("self-signed certificate")) {
    return [
      error.message,
      "",
      "The database accepted the connection details, but local TLS verification rejected the certificate chain.",
      "The fast ingestion script now strips sslmode from SUPABASE_DB_URL and applies its own SSL setting with rejectUnauthorized=false.",
      "Retry the command. If this persists, remove sslmode=require from SUPABASE_DB_URL or set SUPABASE_DB_SSL_DISABLE=true only for a local connectivity test.",
    ].join("\n");
  }

  return error?.message ?? String(error);
}

async function ensureFastIngestObjects(client) {
  await client.query("create schema if not exists bronze");
  await client.query(`
    create table if not exists bronze.cbs_typed_dataset_rows_stage (
      load_id uuid not null,
      dataset_id text not null,
      row_id text not null,
      row_index bigint,
      ingestion_run_id uuid,
      source_version text,
      raw jsonb not null,
      ingested_at timestamptz not null default now()
    )
  `);
  await client.query(`
    create index if not exists cbs_typed_dataset_rows_stage_load_idx
      on bronze.cbs_typed_dataset_rows_stage (load_id)
  `);
}

async function upsertCatalogTable(client, table) {
  await client.query(
    `
      insert into bronze.cbs_catalog_tables (
        identifier, title, short_title, short_description, language, catalog, period, updated_at, raw, ingested_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now())
      on conflict (identifier) do update set
        title = excluded.title,
        short_title = excluded.short_title,
        short_description = excluded.short_description,
        language = excluded.language,
        catalog = excluded.catalog,
        period = excluded.period,
        updated_at = excluded.updated_at,
        raw = excluded.raw,
        ingested_at = excluded.ingested_at
    `,
    [
      table.Identifier,
      table.Title ?? table.Identifier,
      table.ShortTitle ?? null,
      table.ShortDescription ?? null,
      table.Language ?? null,
      table.Catalog ?? null,
      table.Period ?? null,
      table.Updated ?? null,
      JSON.stringify(table),
    ]
  );
}

async function shouldIncludeDataset(client, table, options) {
  if (options.dryRun) return true;

  const result = await client.query(
    `
      select
        status.status,
        status.last_cbs_updated_at,
        exists (
          select 1
          from bronze.cbs_dataset_theme_hierarchy theme
          where theme.dataset_id = $1
            and lower(theme.top_theme_title) = 'archief'
        ) as is_archive
      from (select $1::text as dataset_id) selected
      left join bronze.cbs_dataset_ingestion_status status
        on status.dataset_id = selected.dataset_id
    `,
    [table.Identifier]
  );
  const status = result.rows[0];

  if (!options.includeArchive && status?.is_archive) return false;

  if (options.force) return true;

  if (options.failedOnly) {
    return [
      STATUS.FAILED,
      STATUS.METADATA_LOADED,
      STATUS.PARTIAL,
      "metadata_completed",
      "rows_partial",
    ].includes(status?.status);
  }

  if (!status) return true;
  if (![STATUS.COMPLETE, "completed"].includes(status.status)) return true;

  const previousUpdated = status.last_cbs_updated_at ? new Date(status.last_cbs_updated_at).toISOString() : null;
  const currentUpdated = table.Updated ? new Date(table.Updated).toISOString() : null;
  return previousUpdated !== currentUpdated;
}

async function startRun(client, datasetId, sourceVersion, expectedRows) {
  const result = await client.query(
    `
      insert into bronze.cbs_ingestion_runs (dataset_id, status, source_version, expected_rows)
      values ($1, $2, $3, $4)
      returning id
    `,
    [datasetId, STATUS.PENDING, sourceVersion, expectedRows]
  );
  return result.rows[0].id;
}

async function finishRun(client, runId, status, rowsIngested, errorMessage = null) {
  await client.query(
    `
      update bronze.cbs_ingestion_runs
      set status = $2,
          rows_ingested = $3,
          error_message = $4,
          finished_at = now()
      where id = $1
    `,
    [runId, status, rowsIngested, errorMessage]
  );
}

async function updateDatasetStatus(client, table, recordCount, status, loadedRowCount, runId, errorMessage = null) {
  await client.query(
    `
      insert into bronze.cbs_dataset_ingestion_status (
        dataset_id,
        title,
        last_cbs_updated_at,
        last_ingested_at,
        record_count,
        loaded_row_count,
        load_percentage,
        source_version,
        last_run_id,
        row_completeness_pct,
        quality_status,
        quality_checks,
        status,
        error_message
      )
      values ($1, $2, $3, now(), $4, $5, $6, $7, $8, $6, $9, $10::jsonb, $11, $12)
      on conflict (dataset_id) do update set
        title = excluded.title,
        last_cbs_updated_at = excluded.last_cbs_updated_at,
        last_ingested_at = excluded.last_ingested_at,
        record_count = excluded.record_count,
        loaded_row_count = excluded.loaded_row_count,
        load_percentage = excluded.load_percentage,
        source_version = excluded.source_version,
        last_run_id = excluded.last_run_id,
        row_completeness_pct = excluded.row_completeness_pct,
        quality_status = excluded.quality_status,
        quality_checks = excluded.quality_checks,
        status = excluded.status,
        error_message = excluded.error_message
    `,
    [
      table.Identifier,
      table.ShortTitle || table.Title || table.Identifier,
      table.Updated ?? null,
      recordCount,
      loadedRowCount,
      pct(loadedRowCount, recordCount),
      table.Updated ?? null,
      runId,
      status === STATUS.COMPLETE ? "passed" : loadedRowCount > 0 ? "warning" : "pending",
      JSON.stringify({
        fast_direct_postgres_ingest: {
          status: "pass",
          actual: loadedRowCount,
          expected: recordCount,
        },
      }),
      status,
      errorMessage,
    ]
  );
}

async function getMaxIngestedRowIndex(client, datasetId) {
  const result = await client.query(
    `
      select row_index
      from bronze.cbs_typed_dataset_rows
      where dataset_id = $1
      order by row_index desc
      limit 1
    `,
    [datasetId]
  );
  return result.rows[0]?.row_index === undefined || result.rows[0]?.row_index === null
    ? -1
    : Number(result.rows[0].row_index);
}

async function getLoadedRowCountEstimate(client, datasetId) {
  const maxRowIndex = await getMaxIngestedRowIndex(client, datasetId);
  return maxRowIndex < 0 ? 0 : maxRowIndex + 1;
}

async function deleteDatasetRows(client, datasetId) {
  await client.query("delete from bronze.cbs_typed_dataset_rows where dataset_id = $1", [datasetId]);
}

async function writeRowsViaStage(client, loadId, datasetId, rows, skip, runId, sourceVersion, options) {
  const datasetIds = [];
  const rowIds = [];
  const rowIndexes = [];
  const raws = [];

  rows.forEach((row, index) => {
    const rowIndex = skip + index;
    datasetIds.push(datasetId);
    rowIds.push(row.ID === undefined || row.ID === null ? String(rowIndex) : String(row.ID));
    rowIndexes.push(rowIndex);
    raws.push(JSON.stringify(row));
  });

  await client.query("begin");
  try {
    await client.query(
      `
        insert into bronze.cbs_typed_dataset_rows_stage (
          load_id, dataset_id, row_id, row_index, ingestion_run_id, source_version, raw, ingested_at
        )
        select $1::uuid, staged.dataset_id, staged.row_id, staged.row_index, $2::uuid, $3::text, staged.raw, now()
        from unnest($4::text[], $5::text[], $6::bigint[], $7::jsonb[]) as staged(dataset_id, row_id, row_index, raw)
      `,
      [loadId, runId, sourceVersion, datasetIds, rowIds, rowIndexes, raws]
    );

    const result = await client.query(
      `
        insert into bronze.cbs_typed_dataset_rows (
          dataset_id, row_id, row_index, ingestion_run_id, source_version, raw, ingested_at
        )
        select dataset_id, row_id, row_index, ingestion_run_id, source_version, raw, ingested_at
        from bronze.cbs_typed_dataset_rows_stage
        where load_id = $1
        on conflict (dataset_id, row_id) do nothing
      `,
      [loadId]
    );

    await client.query("delete from bronze.cbs_typed_dataset_rows_stage where load_id = $1", [loadId]);
    await client.query("commit");
    return result.rowCount ?? rows.length;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

function rowChunks(rows, chunkSize) {
  const size = Math.max(1, chunkSize);
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push({
      startIndex: index,
      rows: rows.slice(index, index + size),
    });
  }
  return chunks;
}

async function ingestDatasetRows(client, table, recordCount, options, runId) {
  const datasetId = table.Identifier;
  const sourceVersion = table.Updated ?? null;
  const maxRows =
    options.maxRowsPerDataset > 0
      ? Math.min(options.maxRowsPerDataset, recordCount ?? options.maxRowsPerDataset)
      : recordCount;

  if (!maxRows) return 0;

  if (options.force) {
    console.log(`  force enabled: deleting existing Bronze rows (${datasetId})`);
    await deleteDatasetRows(client, datasetId);
  }

  let startSkip = 0;
  if (options.resumeRows && !options.force) {
    const maxIngestedRowIndex = await getMaxIngestedRowIndex(client, datasetId);
    startSkip = Math.max(0, maxIngestedRowIndex + 1);
    if (startSkip > 0) console.log(`  resuming rows from offset ${startSkip} (${datasetId})`);
  }

  if (startSkip >= maxRows) {
    console.log(`  rows already complete (${datasetId})`);
    return 0;
  }

  let written = 0;
  const loadId = runId;

  for (let skip = startSkip; skip < maxRows; skip += options.batchSize) {
    const top = Math.min(options.batchSize, maxRows - skip);
    console.log(`  fetching rows ${skip + 1}-${skip + top} (${datasetId})`);
    const rows = await getTypedRows(datasetId, skip, top, options);
    if (rows.length === 0) break;

    if (!options.dryRun) {
      const writeBatchSize = Math.max(1, Math.min(options.upsertBatchSize || options.batchSize, rows.length));
      for (const chunk of rowChunks(rows, writeBatchSize)) {
        const chunkStart = skip + chunk.startIndex;
        const chunkEnd = chunkStart + chunk.rows.length;
        console.log(`  writing rows ${chunkStart + 1}-${chunkEnd} (${datasetId})`);
        await writeRowsViaStage(client, loadId, datasetId, chunk.rows, chunkStart, runId, sourceVersion, options);
      }
    }

    written += rows.length;
    console.log(`  rows ${skip + rows.length}/${maxRows} (${datasetId})`);
    if (rows.length < top) break;
  }

  return written;
}

async function ingestTable(client, table, options) {
  const datasetId = table.Identifier;
  const recordCount = await getTypedDataSetCount(datasetId, options);
  const expectedRows = options.maxRowsPerDataset > 0
    ? Math.min(options.maxRowsPerDataset, recordCount ?? options.maxRowsPerDataset)
    : recordCount;

  if (options.dryRun) {
    console.log(JSON.stringify({
      datasetId,
      title: table.ShortTitle || table.Title,
      recordCount,
      rowsToIngest: expectedRows,
      directPostgres: true,
    }));
    return;
  }

  await upsertCatalogTable(client, table);
  const runId = await startRun(client, datasetId, table.Updated ?? null, expectedRows);

  try {
    await updateDatasetStatus(client, table, recordCount, STATUS.METADATA_LOADED, await getLoadedRowCountEstimate(client, datasetId), runId);
    const writtenRows = await ingestDatasetRows(client, table, recordCount, options, runId);
    const loadedRows = await getLoadedRowCountEstimate(client, datasetId);
    const finalStatus = recordCount !== null && loadedRows >= recordCount
      ? STATUS.COMPLETE
      : loadedRows > 0
        ? STATUS.PARTIAL
        : STATUS.METADATA_LOADED;

    await finishRun(client, runId, finalStatus, writtenRows);
    await updateDatasetStatus(client, table, recordCount, finalStatus, loadedRows, runId);

    console.log(`Fast Bronze ${finalStatus} ${datasetId}: ${writtenRows} rows this run, ${loadedRows}/${recordCount ?? "unknown"} total rows loaded`);
  } catch (error) {
    await finishRun(client, runId, STATUS.FAILED, 0, error.message);
    const loadedRows = await getLoadedRowCountEstimate(client, datasetId).catch(() => 0);
    await updateDatasetStatus(client, table, recordCount, STATUS.PARTIAL, loadedRows, runId, error.message);
    throw error;
  }
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const tables = await getCatalogTables(options);

  console.log(`Found ${tables.length} CBS table(s) for fast Bronze row ingestion.`);

  if (options.dryRun) {
    for (const table of tables) await ingestTable(null, table, options);
    return;
  }

  const client = postgresClient(options);
  try {
    await client.connect();
  } catch (error) {
    throw new Error(explainPostgresConnectionError(error));
  }

  try {
    await ensureFastIngestObjects(client);

    for (const table of tables) {
      if (!(await shouldIncludeDataset(client, table, options))) {
        console.log(`Skipped ${table.Identifier}: not selected by archive/status/source filters.`);
        continue;
      }

      let lastError = null;
      for (let attempt = 1; attempt <= options.retries + 1; attempt += 1) {
        try {
          console.log(`Fast ingesting ${table.Identifier}, attempt ${attempt}/${options.retries + 1}`);
          await ingestTable(client, table, options);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          console.error(`Failed ${table.Identifier}, attempt ${attempt}: ${error.message}`);
          if (attempt <= options.retries) await sleep(1000 * attempt);
        }
      }

      if (lastError) throw lastError;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
