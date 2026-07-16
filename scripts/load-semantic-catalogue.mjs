#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

function parseArgs(argv) {
  const options = { ensureSchema: false, domain: "", limit: 100000, writeTimeoutMs: 900000 };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--ensure-schema") options.ensureSchema = true;
    else if (arg === "--domain") options.domain = argv[++index] ?? "";
    else if (arg === "--limit") options.limit = Number(argv[++index] ?? options.limit);
    else if (arg === "--write-timeout-ms") options.writeTimeoutMs = Number(argv[++index] ?? options.writeTimeoutMs);
    else if (arg === "--help") {
      console.log(`Usage:
  npm run load:semantic:catalogue -- --ensure-schema
  npm run load:semantic:catalogue -- --domain bouwen-en-wonen

Options:
  --ensure-schema           Execute supabase/semantic_catalogue_schema.sql first.
  --domain bouwen-en-wonen  Limit domain-specific catalogue rows.
  --limit 100000            Maximum source rows per object family.
`);
      process.exit(0);
    }
  }
  return options;
}

function embedding(text) {
  const vector = Array.from({ length: 64 }, () => 0);
  const tokens = String(text ?? "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const token of tokens) {
    const digest = createHash("sha256").update(token).digest();
    for (let i = 0; i < 8; i += 1) {
      const index = digest[i] % vector.length;
      vector[index] += digest[i + 8] >= 128 ? -1 : 1;
    }
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return `[${vector.map((value) => (value / norm).toFixed(6)).join(",")}]`;
}

async function ensureSchema(client) {
  await client.query(readFileSync(resolve(process.cwd(), "supabase/gold_schema.sql"), "utf8"));
  await client.query(readFileSync(resolve(process.cwd(), "supabase/gold_bouwen_wonen_schema.sql"), "utf8"));
  await client.query(readFileSync(resolve(process.cwd(), "supabase/semantic_catalogue_schema.sql"), "utf8"));
}

async function upsertItems(client, rows) {
  if (!rows.length) return 0;
  await client.query(
    `
      insert into semantic.catalogue_item (
        object_type, object_id, source_schema, source_table, source_pk, title, subtitle, description,
        search_text, provider, dataset_code, measure_code, geography_code, unit_code, domain_id, tags, metadata, embedding
      )
      select *
      from unnest(
        $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[],
        $9::text[], $10::text[], $11::text[], $12::text[], $13::text[], $14::text[], $15::text[], $16::text[][],
        $17::jsonb[], $18::vector(64)[]
      ) as rows(
        object_type, object_id, source_schema, source_table, source_pk, title, subtitle, description,
        search_text, provider, dataset_code, measure_code, geography_code, unit_code, domain_id, tags, metadata, embedding
      )
      on conflict (object_type, object_id) do update set
        title = excluded.title,
        subtitle = excluded.subtitle,
        description = excluded.description,
        search_text = excluded.search_text,
        provider = excluded.provider,
        dataset_code = excluded.dataset_code,
        measure_code = excluded.measure_code,
        geography_code = excluded.geography_code,
        unit_code = excluded.unit_code,
        domain_id = excluded.domain_id,
        tags = excluded.tags,
        metadata = excluded.metadata,
        embedding = excluded.embedding,
        is_active = true,
        updated_at = now()
    `,
    [
      rows.map((row) => row.objectType),
      rows.map((row) => row.objectId),
      rows.map((row) => row.sourceSchema),
      rows.map((row) => row.sourceTable),
      rows.map((row) => row.sourcePk),
      rows.map((row) => row.title),
      rows.map((row) => row.subtitle),
      rows.map((row) => row.description),
      rows.map((row) => row.searchText),
      rows.map((row) => row.provider),
      rows.map((row) => row.datasetCode),
      rows.map((row) => row.measureCode),
      rows.map((row) => row.geographyCode),
      rows.map((row) => row.unitCode),
      rows.map((row) => row.domainId),
      rows.map((row) => row.tags),
      rows.map((row) => JSON.stringify(row.metadata ?? {})),
      rows.map((row) => row.embedding),
    ]
  );
  return rows.length;
}

function item({ objectType, objectId, sourceSchema, sourceTable, sourcePk, title, subtitle = null, description = null, searchText, provider = "CBS", datasetCode = null, measureCode = null, geographyCode = null, unitCode = null, domainId = null, tags = [], metadata = {} }) {
  const combined = [title, subtitle, description, searchText, tags.join(" ")].filter(Boolean).join(" ");
  return {
    objectType,
    objectId,
    sourceSchema,
    sourceTable,
    sourcePk,
    title,
    subtitle,
    description,
    searchText: searchText || combined,
    provider,
    datasetCode,
    measureCode,
    geographyCode,
    unitCode,
    domainId,
    tags,
    metadata,
    embedding: embedding(combined),
  };
}

async function loadCatalogue(client, options) {
  const domainWhere = options.domain ? "where coalesce(hd.domain_id, dd.domain_id) = $1" : "";
  const params = options.domain ? [options.domain, options.limit] : [options.limit];
  const limitParam = options.domain ? "$2" : "$1";

  const datasets = await client.query(
    `
      select d.*, coalesce(hd.domain_id, dd.domain_id) as domain_id
      from gold.dim_dataset d
      left join gold_bouwen_wonen.dim_housing_dataset hd on hd.dataset_key = d.dataset_key
      left join silver.cbs_dataset_domains dd on dd.dataset_id = d.dataset_code
      ${domainWhere}
      order by d.dataset_code
      limit ${limitParam}
    `,
    params
  );

  const measures = await client.query(
    `
      select m.*, u.unit_code, d.dataset_key, coalesce(hd.domain_id, dd.domain_id) as domain_id
      from gold.dim_measure m
      join gold.dim_unit u on u.unit_key = m.unit_key
      left join gold.dim_dataset d on d.dataset_code = m.dataset_code and d.source_system = m.source_system
      left join gold_bouwen_wonen.dim_housing_dataset hd on hd.dataset_key = d.dataset_key
      left join silver.cbs_dataset_domains dd on dd.dataset_id = m.dataset_code
      ${domainWhere}
      order by m.dataset_code, m.measure_code
      limit ${limitParam}
    `,
    params
  );

  const geographies = await client.query(
    `
      select *
      from gold.dim_geography
      where geography_code <> 'UNKNOWN'
      order by geography_type, geography_name
      limit $1
    `,
    [options.limit]
  );

  const categories = await client.query(
    `
      select c.*, d.dataset_code, dd.domain_id
      from gold.dim_category c
      join gold.dim_dataset d on d.dataset_key = c.dataset_key
      left join silver.cbs_dataset_domains dd on dd.dataset_id = d.dataset_code
      ${options.domain ? "where dd.domain_id = $1" : ""}
      order by d.dataset_code, c.dimension_code, c.category_name
      limit ${options.domain ? "$2" : "$1"}
    `,
    params
  );

  const rows = [
    ...datasets.rows.map((row) => item({
      objectType: "dataset",
      objectId: String(row.dataset_key),
      sourceSchema: "gold",
      sourceTable: "dim_dataset",
      sourcePk: String(row.dataset_key),
      title: row.dataset_title,
      subtitle: row.dataset_code,
      description: row.dataset_description,
      searchText: `${row.dataset_code} ${row.dataset_title} ${row.dataset_description ?? ""}`,
      datasetCode: row.dataset_code,
      domainId: row.domain_id,
      tags: ["dataset", row.source_system, row.domain_id].filter(Boolean),
      metadata: { dataset_key: row.dataset_key, source_url: row.source_url, dataset_version: row.dataset_version },
    })),
    ...measures.rows.map((row) => item({
      objectType: "measure",
      objectId: String(row.measure_key),
      sourceSchema: "gold",
      sourceTable: "dim_measure",
      sourcePk: String(row.measure_key),
      title: row.measure_name,
      subtitle: `${row.dataset_code} · ${row.unit_code}`,
      description: row.measure_description,
      searchText: `${row.measure_code} ${row.measure_name} ${row.measure_description ?? ""} ${row.topic ?? ""} ${row.subtopic ?? ""} ${row.unit_code}`,
      datasetCode: row.dataset_code,
      measureCode: row.measure_code,
      unitCode: row.unit_code,
      domainId: row.domain_id,
      tags: ["measure", row.value_type, row.default_aggregation, row.domain_id].filter(Boolean),
      metadata: { measure_key: row.measure_key, dataset_key: row.dataset_key, aggregation: row.default_aggregation, value_type: row.value_type },
    })),
    ...geographies.rows.map((row) => item({
      objectType: "geography",
      objectId: String(row.geography_key),
      sourceSchema: "gold",
      sourceTable: "dim_geography",
      sourcePk: String(row.geography_key),
      title: row.geography_name,
      subtitle: `${row.geography_type} · ${row.geography_code}`,
      description: row.geography_type,
      searchText: `${row.geography_code} ${row.geography_name} ${row.geography_type} ${row.municipality_code ?? ""} ${row.province_code ?? ""}`,
      geographyCode: row.geography_code,
      tags: ["geography", row.geography_type].filter(Boolean),
      metadata: { geography_key: row.geography_key, geography_type: row.geography_type, country_code: row.country_code },
    })),
    ...categories.rows.map((row) => item({
      objectType: "category",
      objectId: String(row.category_key),
      sourceSchema: "gold",
      sourceTable: "dim_category",
      sourcePk: String(row.category_key),
      title: row.category_name,
      subtitle: `${row.dataset_code} · ${row.dimension_code}`,
      description: row.category_description,
      searchText: `${row.category_code} ${row.category_name} ${row.category_description ?? ""} ${row.dimension_code} ${row.dataset_code}`,
      datasetCode: row.dataset_code,
      domainId: row.domain_id,
      tags: ["category", row.dimension_code, row.domain_id].filter(Boolean),
      metadata: { category_key: row.category_key, dimension_code: row.dimension_code, category_code: row.category_code },
    })),
  ];

  return upsertItems(client, rows);
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const client = createPostgresClient({
    applicationName: "guara-semantic-catalogue-loader",
    statementTimeoutMs: Math.max(1, options.writeTimeoutMs),
    queryTimeoutMs: Math.max(1, options.writeTimeoutMs),
  });

  try {
    await client.connect();
  } catch (error) {
    throw new Error(explainPostgresConnectionError(error));
  }

  try {
    if (options.ensureSchema) await ensureSchema(client);
    const count = await loadCatalogue(client, options);
    console.log(`Loaded ${count} semantic catalogue item(s).`);
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
