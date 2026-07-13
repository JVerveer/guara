#!/usr/bin/env node
import pg from "pg";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const { Client } = pg;

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
    dryRun: false,
    limitDatasets: 25,
    dataset: "",
    analyze: true,
    includeRawBatchPayloads: true,
    rowChunkSize: 100000,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--limit-datasets") options.limitDatasets = Number(argv[++index] ?? options.limitDatasets);
    else if (arg === "--dataset") options.dataset = argv[++index] ?? "";
    else if (arg === "--row-chunk-size") options.rowChunkSize = Number(argv[++index] ?? options.rowChunkSize);
    else if (arg === "--no-analyze") options.analyze = false;
    else if (arg === "--keep-typed-batch-payloads") options.includeRawBatchPayloads = false;
    else if (arg === "--help") {
      console.log(`Usage:
  npm run purge:cbs:bronze:archief -- --dry-run --limit-datasets 25
  npm run purge:cbs:bronze:archief -- --limit-datasets 25
  npm run purge:cbs:bronze:archief -- --dataset 00370

This removes hot Bronze row storage for CBS root theme Archief while keeping catalog,
theme, data property, dimension, and source metadata for future Cloudflare/R2 reloads.

Options:
  --dry-run                       Show candidate datasets without deleting.
  --limit-datasets 25             Number of Archief datasets to purge this run.
  --dataset 00370                 Purge one specific Archief dataset.
  --row-chunk-size 100000         Delete raw rows in row_index chunks.
  --keep-typed-batch-payloads     Keep duplicate typed_dataset_batch raw payloads.
  --no-analyze                    Skip analyze after purge.
`);
      process.exit(0);
    }
  }

  return options;
}

function postgresClient() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error("Missing SUPABASE_DB_URL in .env.local.");

  const url = new URL(connectionString);
  ["sslmode", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"].forEach((key) => url.searchParams.delete(key));
  url.searchParams.set("application_name", "guara-purge-cbs-archief-bronze");

  return new Client({
    connectionString: url.toString(),
    ssl: process.env.SUPABASE_DB_SSL_DISABLE === "true" ? false : { rejectUnauthorized: false },
    statement_timeout: 0,
    query_timeout: 0,
  });
}

async function ensureRetentionTable(client) {
  await client.query("create schema if not exists bronze");
  await client.query(`
    create table if not exists bronze.cbs_dataset_retention_policy (
      dataset_id text primary key,
      root_theme_title text,
      retention_tier text not null,
      keep_raw_rows boolean not null default false,
      storage_provider text,
      storage_location text,
      reason text,
      updated_at timestamptz not null default now()
    )
  `);
}

async function getPurgeCandidates(client, options) {
  const params = [];
  let datasetFilter = "";
  let limitClause = "";

  if (options.dataset) {
    params.push(options.dataset);
    datasetFilter = `and h.dataset_id = $${params.length}`;
  } else {
    params.push(Math.max(1, options.limitDatasets));
    limitClause = `limit $${params.length}`;
  }

  const result = await client.query(
    `
      select
        h.dataset_id,
        max(h.top_theme_title) as root_theme_title,
        coalesce(max(s.loaded_row_count), 0)::bigint as loaded_row_count,
        coalesce(max(s.record_count), 0)::bigint as record_count,
        max(s.status) as status
      from bronze.cbs_dataset_theme_hierarchy h
      left join bronze.cbs_dataset_ingestion_status s on s.dataset_id = h.dataset_id
      where lower(h.top_theme_title) = 'archief'
        ${datasetFilter}
        and (
          coalesce(s.loaded_row_count, 0) > 0
          or exists (
            select 1
            from bronze.cbs_raw_endpoint_payloads payload
            where payload.dataset_id = h.dataset_id
              and payload.endpoint like 'typed_dataset_batch:%'
          )
        )
      group by h.dataset_id
      order by coalesce(max(s.loaded_row_count), 0) desc, h.dataset_id
      ${limitClause}
    `,
    params
  );

  return result.rows;
}

async function purgeDataset(client, candidate, options) {
  let totalRowsDeleted = 0;
  const chunkSize = Math.max(1, options.rowChunkSize);

  while (true) {
    const deleteResult = await client.query(
      `
        with next_rows as (
          select ctid
          from bronze.cbs_typed_dataset_rows
          where dataset_id = $1
          limit $2
        )
        delete from bronze.cbs_typed_dataset_rows rows
        using next_rows
        where rows.ctid = next_rows.ctid
      `,
      [candidate.dataset_id, chunkSize]
    );

    totalRowsDeleted += deleteResult.rowCount ?? 0;
    if ((deleteResult.rowCount ?? 0) === 0) break;

    const remaining = await client.query(
      "select 1 from bronze.cbs_typed_dataset_rows where dataset_id = $1 limit 1",
      [candidate.dataset_id]
    );

    if (remaining.rows.length === 0) break;
    console.log(`    deleted ${totalRowsDeleted} row(s) so far for ${candidate.dataset_id}; more rows remain`);
  }

  let payloadDelete = { rowCount: 0 };
  if (options.includeRawBatchPayloads) {
    payloadDelete = await client.query(
      `
        delete from bronze.cbs_raw_endpoint_payloads
        where dataset_id = $1
          and endpoint like 'typed_dataset_batch:%'
      `,
      [candidate.dataset_id]
    );
  }

  await client.query("begin");
  try {
    await client.query(
      `
        insert into bronze.cbs_dataset_retention_policy (
          dataset_id,
          root_theme_title,
          retention_tier,
          keep_raw_rows,
          reason,
          updated_at
        )
        values ($1, $2, 'deferred_cloudflare_r2', false, $3, now())
        on conflict (dataset_id) do update set
          root_theme_title = excluded.root_theme_title,
          retention_tier = excluded.retention_tier,
          keep_raw_rows = excluded.keep_raw_rows,
          reason = excluded.reason,
          updated_at = excluded.updated_at
      `,
      [
        candidate.dataset_id,
        candidate.root_theme_title,
        "CBS Archief raw rows removed from hot Supabase Bronze; reload to Cloudflare/R2 later.",
      ]
    );

    await client.query(
      `
        update bronze.cbs_dataset_ingestion_status
        set
          loaded_row_count = 0,
          load_percentage = 0,
          row_completeness_pct = 0,
          status = 'metadata_loaded',
          quality_status = 'pending',
          quality_checks = jsonb_set(
            coalesce(quality_checks, '{}'::jsonb),
            '{archief_hot_rows_purged}',
            to_jsonb(json_build_object(
              'status', 'info',
              'message', 'Archief raw rows purged from hot Supabase Bronze; metadata retained for future cold storage reload.',
              'purged_at', now()
            )),
            true
          ),
          error_message = null,
          last_ingested_at = now()
        where dataset_id = $1
      `,
      [candidate.dataset_id]
    );

    await client.query("commit");
    return {
      datasetId: candidate.dataset_id,
      rowsDeleted: totalRowsDeleted,
      batchPayloadsDeleted: payloadDelete.rowCount ?? 0,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function analyzeTables(client) {
  await client.query("analyze bronze.cbs_typed_dataset_rows");
  await client.query("analyze bronze.cbs_dataset_ingestion_status");
  await client.query("analyze bronze.cbs_raw_endpoint_payloads");
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const client = postgresClient();
  await client.connect();

  try {
    await ensureRetentionTable(client);
    const candidates = await getPurgeCandidates(client, options);

    console.log(
      `Found ${candidates.length} Archief purge candidate(s)${options.dryRun ? " (dry run)" : ""}.`
    );
    console.table(
      candidates.map((candidate) => ({
        dataset: candidate.dataset_id,
        status: candidate.status,
        loadedRows: candidate.loaded_row_count,
        apiRecords: candidate.record_count,
      }))
    );

    if (options.dryRun || candidates.length === 0) return;

    let totalRowsDeleted = 0;
    let totalPayloadsDeleted = 0;

    for (const candidate of candidates) {
      console.log(`Purging Archief raw rows for ${candidate.dataset_id}`);
      const result = await purgeDataset(client, candidate, options);
      totalRowsDeleted += result.rowsDeleted;
      totalPayloadsDeleted += result.batchPayloadsDeleted;
      console.log(
        `  purged ${result.rowsDeleted} rows and ${result.batchPayloadsDeleted} typed batch payload(s) (${candidate.dataset_id})`
      );
    }

    if (options.analyze) {
      console.log("Analyzing Bronze tables...");
      await analyzeTables(client);
    }

    console.log(
      `Done. Purged ${totalRowsDeleted} hot Archief row(s) and ${totalPayloadsDeleted} typed batch payload(s).`
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
