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
  npm run load:semantic -- --ensure-schema
  npm run load:semantic:catalogue -- --ensure-schema
  npm run load:semantic:catalogue -- --domain bouwen-en-wonen

Options:
  --ensure-schema           Execute semantic and search schema files first.
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

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function metricCode(row) {
  return normalizeText(`cbs ${row.dataset_code} ${row.measure_code} ${row.unit_code ?? ""} ${row.measure_key}`)
    .replace(/\s+/g, "_")
    .slice(0, 180);
}

function approvedAggregation(row) {
  const aggregation = String(row.default_aggregation ?? "none").toLowerCase();
  const valueType = String(row.value_type ?? "").toLowerCase();
  if (row.is_percentage || row.is_index || ["percentage", "index", "average", "median", "ratio"].includes(valueType)) {
    return aggregation === "sum" ? "average" : aggregation || "average";
  }
  return aggregation || "none";
}

function isSafeAggregation(aggregation) {
  const normalized = String(aggregation ?? "").toLowerCase();
  return ["sum", "average", "min", "max", "count", "latest"].includes(normalized);
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let dollarQuote = "";

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    current += char;

    if (dollarQuote) {
      if (sql.startsWith(dollarQuote, index)) {
        current += sql.slice(index + 1, index + dollarQuote.length);
        index += dollarQuote.length - 1;
        dollarQuote = "";
      }
      continue;
    }

    if (char === "$") {
      const match = sql.slice(index).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollarQuote = match[0];
        current += sql.slice(index + 1, index + dollarQuote.length);
        index += dollarQuote.length - 1;
      }
      continue;
    }

    if (!dollarQuote && char === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
    }
  }

  const trailing = current.trim();
  if (trailing) statements.push(trailing);
  return statements;
}

async function executeSqlFile(client, filePath) {
  const sql = readFileSync(resolve(process.cwd(), filePath), "utf8");
  const statements = splitSqlStatements(sql);
  for (let index = 0; index < statements.length; index += 1) {
    const statement = statements[index];
    try {
      await client.query(statement);
    } catch (error) {
      const preview = statement.replace(/\s+/g, " ").slice(0, 240);
      error.message = `Failed schema statement ${index + 1}/${statements.length} from ${filePath}: ${preview}\n${error.message}`;
      throw error;
    }
  }
}

async function ensureSchema(client) {
  await executeSqlFile(client, "supabase/semantic_catalogue_schema.sql");
  await executeSqlFile(client, "supabase/search_schema.sql");
}

async function upsertItems(client, rows) {
  const deduped = Array.from(new Map(rows.map((row) => [`${row.objectType}:${row.objectId}`, row])).values());
  if (!deduped.length) return 0;
  await client.query(
    `
      insert into semantic.catalogue_item (
        object_type, object_id, source_schema, source_table, source_pk, title, subtitle, description,
        search_text, provider, dataset_code, measure_code, geography_code, unit_code, domain_id, tags, metadata, embedding
      )
      select
        rows.object_type,
        rows.object_id,
        rows.source_schema,
        rows.source_table,
        rows.source_pk,
        rows.title,
        rows.subtitle,
        rows.description,
        rows.search_text,
        rows.provider,
        rows.dataset_code,
        rows.measure_code,
        rows.geography_code,
        rows.unit_code,
        rows.domain_id,
        tag_values.tags,
        rows.metadata,
        rows.embedding
      from unnest(
        $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[],
        $9::text[], $10::text[], $11::text[], $12::text[], $13::text[], $14::text[], $15::text[], $16::jsonb[],
        $17::jsonb[], $18::vector(64)[]
      ) as rows(
        object_type, object_id, source_schema, source_table, source_pk, title, subtitle, description,
        search_text, provider, dataset_code, measure_code, geography_code, unit_code, domain_id, tags_json, metadata, embedding
      )
      cross join lateral (
        select coalesce(array_agg(value), '{}'::text[]) as tags
        from jsonb_array_elements_text(rows.tags_json) as value
      ) tag_values
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
      deduped.map((row) => row.objectType),
      deduped.map((row) => row.objectId),
      deduped.map((row) => row.sourceSchema),
      deduped.map((row) => row.sourceTable),
      deduped.map((row) => row.sourcePk),
      deduped.map((row) => row.title),
      deduped.map((row) => row.subtitle),
      deduped.map((row) => row.description),
      deduped.map((row) => row.searchText),
      deduped.map((row) => row.provider),
      deduped.map((row) => row.datasetCode),
      deduped.map((row) => row.measureCode),
      deduped.map((row) => row.geographyCode),
      deduped.map((row) => row.unitCode),
      deduped.map((row) => row.domainId),
      deduped.map((row) => JSON.stringify(row.tags ?? [])),
      deduped.map((row) => JSON.stringify(row.metadata ?? {})),
      deduped.map((row) => row.embedding),
    ]
  );
  return deduped.length;
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

async function upsertSemanticMetrics(client, measures) {
  if (!measures.length) return new Map();

  const metricPayloadByName = new Map();
  for (const row of measures) {
    const aggregation = approvedAggregation(row);
    const complete = row.measure_key && row.dataset_key && row.unit_key && isSafeAggregation(aggregation);
    const next = {
      metric_code: metricCode(row),
      metric_name: metricCode(row),
      metric_label: row.measure_name,
      description: row.measure_description,
      measure_key: row.measure_key,
      dataset_key: row.dataset_key,
      aggregation,
      unit_key: row.unit_key,
      value_type: row.value_type,
      default_time_dimension: "time",
      default_geography_level: "geography",
      is_additive: Boolean(row.is_additive) && !row.is_percentage && !row.is_index,
      is_semi_additive: Boolean(row.is_semi_additive),
      is_non_additive: Boolean(row.is_non_additive) || row.is_percentage || row.is_index,
      supports_time_comparison: true,
      supports_geography_comparison: true,
      is_enabled: Boolean(complete),
      metadata_completeness_status: complete ? "complete" : "incomplete",
      metadata_origin: "generated",
    };
    metricPayloadByName.set(next.metric_name, next);
  }
  const payload = Array.from(metricPayloadByName.values());

  const result = await client.query(
    `
      with input as (
        select *
        from jsonb_to_recordset($1::jsonb) as row(
          metric_code text,
          metric_name text,
          metric_label text,
          description text,
          measure_key bigint,
          dataset_key bigint,
          aggregation text,
          unit_key bigint,
          value_type text,
          default_time_dimension text,
          default_geography_level text,
          is_additive boolean,
          is_semi_additive boolean,
          is_non_additive boolean,
          supports_time_comparison boolean,
          supports_geography_comparison boolean,
          is_enabled boolean,
          metadata_completeness_status text,
          metadata_origin text
        )
      ),
      upserted as (
        insert into semantic.metric (
          metric_code, metric_name, metric_label, description, measure_key, dataset_key, aggregation, unit_key,
          value_type, default_time_dimension, default_geography_level, is_additive, is_semi_additive,
          is_non_additive, supports_time_comparison, supports_geography_comparison, is_enabled,
          metadata_completeness_status, metadata_origin
        )
        select
          metric_code, metric_name, metric_label, description, measure_key, dataset_key, aggregation, unit_key,
          value_type, default_time_dimension, default_geography_level, is_additive, is_semi_additive,
          is_non_additive, supports_time_comparison, supports_geography_comparison, is_enabled,
          metadata_completeness_status, metadata_origin
        from input
        on conflict (metric_name) do update set
          metric_code = case when semantic.metric.metadata_origin = 'curated' then semantic.metric.metric_code else excluded.metric_code end,
          metric_label = case when semantic.metric.metadata_origin = 'curated' then semantic.metric.metric_label else excluded.metric_label end,
          description = case when semantic.metric.metadata_origin = 'curated' then semantic.metric.description else excluded.description end,
          measure_key = coalesce(semantic.metric.measure_key, excluded.measure_key),
          dataset_key = coalesce(semantic.metric.dataset_key, excluded.dataset_key),
          aggregation = case when semantic.metric.metadata_origin = 'curated' then semantic.metric.aggregation else excluded.aggregation end,
          unit_key = coalesce(semantic.metric.unit_key, excluded.unit_key),
          value_type = case when semantic.metric.metadata_origin = 'curated' then semantic.metric.value_type else excluded.value_type end,
          default_time_dimension = case when semantic.metric.metadata_origin = 'curated' then semantic.metric.default_time_dimension else excluded.default_time_dimension end,
          default_geography_level = case when semantic.metric.metadata_origin = 'curated' then semantic.metric.default_geography_level else excluded.default_geography_level end,
          is_additive = case when semantic.metric.metadata_origin = 'curated' then semantic.metric.is_additive else excluded.is_additive end,
          is_semi_additive = case when semantic.metric.metadata_origin = 'curated' then semantic.metric.is_semi_additive else excluded.is_semi_additive end,
          is_non_additive = case when semantic.metric.metadata_origin = 'curated' then semantic.metric.is_non_additive else excluded.is_non_additive end,
          supports_time_comparison = case when semantic.metric.metadata_origin = 'curated' then semantic.metric.supports_time_comparison else excluded.supports_time_comparison end,
          supports_geography_comparison = case when semantic.metric.metadata_origin = 'curated' then semantic.metric.supports_geography_comparison else excluded.supports_geography_comparison end,
          is_enabled = case when semantic.metric.metadata_origin = 'curated' then semantic.metric.is_enabled else excluded.is_enabled end,
          metadata_completeness_status = case when semantic.metric.metadata_origin = 'curated' then semantic.metric.metadata_completeness_status else excluded.metadata_completeness_status end,
          metadata_origin = case when semantic.metric.metadata_origin = 'curated' then semantic.metric.metadata_origin else excluded.metadata_origin end,
          updated_at = now()
        returning metric_id, metric_code, measure_key
      )
      select metric_id, metric_code, measure_key
      from upserted
    `,
    [JSON.stringify(payload)]
  );

  const metricByMeasure = new Map(result.rows.map((row) => [String(row.measure_key), row]));

  await client.query(
    `
      insert into semantic.metric_dimension (
        metric_id, dimension_name, dimension_id, is_required, is_default, supports_grouping, supports_filtering
      )
      select
        m.metric_id,
        d.dimension_code,
        d.dimension_id,
        d.dimension_code in ('time', 'geography'),
        d.dimension_code in ('time', 'geography'),
        d.dimension_code in ('time', 'geography', 'category', 'dataset', 'status'),
        d.dimension_code in ('time', 'geography', 'category', 'dataset', 'status')
      from semantic.metric m
      cross join semantic.dimension d
      where m.measure_key = any($1::bigint[])
        and d.dimension_code in ('time', 'geography', 'category', 'dataset', 'status')
      on conflict (metric_id, dimension_name) do update set
        dimension_id = excluded.dimension_id,
        is_required = case when semantic.metric_dimension.metadata_origin = 'curated' then semantic.metric_dimension.is_required else excluded.is_required end,
        is_default = case when semantic.metric_dimension.metadata_origin = 'curated' then semantic.metric_dimension.is_default else excluded.is_default end,
        supports_grouping = case when semantic.metric_dimension.metadata_origin = 'curated' then semantic.metric_dimension.supports_grouping else excluded.supports_grouping end,
        supports_filtering = case when semantic.metric_dimension.metadata_origin = 'curated' then semantic.metric_dimension.supports_filtering else excluded.supports_filtering end
    `,
    [Array.from(metricByMeasure.keys())]
  );

  return metricByMeasure;
}

async function upsertSynonyms(client, rows) {
  const seen = new Set();
  const synonyms = [];
  for (const row of rows) {
    for (const synonym of row.synonyms.filter(Boolean)) {
      const normalized = normalizeText(synonym);
      if (!normalized) continue;
      const key = `${row.objectType}:${row.objectId}:${normalized}:${row.languageCode ?? "nl"}`;
      if (seen.has(key)) continue;
      seen.add(key);
      synonyms.push({
        object_type: row.objectType,
        object_id: String(row.objectId),
        synonym: String(synonym),
        normalized_synonym: normalized,
        language_code: row.languageCode ?? "nl",
        weight: row.weight ?? 1,
        metadata_origin: "source",
      });
    }
  }
  if (!synonyms.length) return;
  await client.query(
    `
      insert into semantic.synonym (
        object_type, object_id, synonym, normalized_synonym, language_code, weight, metadata_origin
      )
      select object_type, object_id, synonym, normalized_synonym, language_code, weight, metadata_origin
      from jsonb_to_recordset($1::jsonb) as row(
        object_type text,
        object_id text,
        synonym text,
        normalized_synonym text,
        language_code text,
        weight numeric,
        metadata_origin text
      )
      on conflict (object_type, object_id, synonym, language_code) do update set
        normalized_synonym = case when semantic.synonym.metadata_origin = 'curated' then semantic.synonym.normalized_synonym else excluded.normalized_synonym end,
        weight = case when semantic.synonym.metadata_origin = 'curated' then semantic.synonym.weight else excluded.weight end,
        metadata_origin = case when semantic.synonym.metadata_origin = 'curated' then semantic.synonym.metadata_origin else excluded.metadata_origin end
    `,
    [JSON.stringify(synonyms)]
  );
}

async function upsertDefinitionVersions(client, measures) {
  const rows = measures
    .filter((row) => row.measure_description)
    .map((row) => ({
      object_type: "metric",
      object_id: String(row.measure_key),
      definition_text: row.measure_description,
      comparability_status: "unknown",
      source_reference: `CBS ${row.dataset_code} ${row.measure_code}`,
      metadata_origin: "source",
    }));
  if (!rows.length) return;
  await client.query(
    `
      insert into semantic.definition_version (
        object_type, object_id, definition_text, comparability_status, source_reference, metadata_origin
      )
      select object_type, object_id, definition_text, comparability_status, source_reference, metadata_origin
      from jsonb_to_recordset($1::jsonb) as row(
        object_type text,
        object_id text,
        definition_text text,
        comparability_status text,
        source_reference text,
        metadata_origin text
      )
      where not exists (
        select 1
        from semantic.definition_version existing
        where existing.object_type = row.object_type
          and existing.object_id = row.object_id
          and existing.definition_text = row.definition_text
          and coalesce(existing.source_reference, '') = coalesce(row.source_reference, '')
      )
    `,
    [JSON.stringify(rows)]
  );
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
      select
        m.*,
        u.unit_code,
        u.is_percentage,
        u.is_index,
        u.unit_category,
        d.dataset_key,
        coalesce(hd.domain_id, dd.domain_id) as domain_id
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

  const metricByMeasure = await upsertSemanticMetrics(client, measures.rows);
  await upsertDefinitionVersions(client, measures.rows);

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
      metadata: {
        measure_key: row.measure_key,
        dataset_key: row.dataset_key,
        metric_id: metricByMeasure.get(String(row.measure_key))?.metric_id,
        metric_code: metricByMeasure.get(String(row.measure_key))?.metric_code,
        aggregation: approvedAggregation(row),
        value_type: row.value_type,
        metadata_completeness_status: metricByMeasure.get(String(row.measure_key)) ? "complete" : "incomplete",
      },
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

  await upsertSynonyms(client, [
    ...datasets.rows.map((row) => ({
      objectType: "dataset",
      objectId: row.dataset_key,
      synonyms: [row.dataset_code, row.dataset_title],
      weight: 1,
    })),
    ...measures.rows.map((row) => ({
      objectType: "metric",
      objectId: row.measure_key,
      synonyms: [row.measure_code, row.measure_name],
      weight: 1,
    })),
    ...geographies.rows.map((row) => ({
      objectType: "dimension_value",
      objectId: row.geography_key,
      synonyms: [row.geography_code, row.geography_name],
      weight: 1,
    })),
    ...categories.rows.map((row) => ({
      objectType: "dimension_value",
      objectId: row.category_key,
      synonyms: [row.category_code, row.category_name],
      weight: 1,
    })),
  ]);

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
