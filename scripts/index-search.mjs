#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LocalHashEmbeddingProvider, vectorLiteral } from "./lib/embedding-provider.mjs";
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

const DEFAULT_EMBEDDING_VERSION = "v1";

function parseArgs(argv) {
  const options = {
    full: false,
    type: "",
    dataset: "",
    investigation: "",
    limit: 100000,
    batchSize: 1000,
    embeddingVersion: DEFAULT_EMBEDDING_VERSION,
    ensureSchema: false,
    writeTimeoutMs: 900000,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--full") options.full = true;
    else if (arg === "--type") options.type = argv[++index] ?? "";
    else if (arg === "--dataset") options.dataset = argv[++index] ?? "";
    else if (arg === "--investigation") options.investigation = argv[++index] ?? "";
    else if (arg === "--limit") options.limit = Number(argv[++index] ?? options.limit);
    else if (arg === "--batch-size") options.batchSize = Number(argv[++index] ?? options.batchSize);
    else if (arg === "--embedding-version") options.embeddingVersion = argv[++index] ?? options.embeddingVersion;
    else if (arg === "--ensure-schema") options.ensureSchema = true;
    else if (arg === "--write-timeout-ms") options.writeTimeoutMs = Number(argv[++index] ?? options.writeTimeoutMs);
    else if (arg === "--help") {
      console.log(`Usage:
  npm run index:search -- --full
  npm run index:search -- --type metric
  npm run index:search -- --dataset 85455NED
  npm run index:search -- --investigation <id>

Options:
  --full                         Rebuild the selected search scope and remove stale documents.
  --type metric                  Index one object type.
  --dataset 85455NED             Index one dataset and its child objects.
  --investigation <uuid>         Index one investigation-specific scope where supported.
  --embedding-version v1         Re-embed objects when the stored version differs.
  --batch-size 1000              Rows written per database batch.
  --ensure-schema                Apply supabase/search_schema.sql before indexing.
`);
      process.exit(0);
    }
  }

  return options;
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

async function ensureSchema(client) {
  const sql = readFileSync(resolve(process.cwd(), "supabase/search_schema.sql"), "utf8");
  for (const statement of splitSqlStatements(sql)) await client.query(statement);
}

function scopeKey(row) {
  if (row.investigation_id) return `investigation:${row.investigation_id}`;
  if (row.workspace_id) return `workspace:${row.workspace_id}`;
  return "global";
}

function normalizeType(type) {
  if (type === "measure") return "metric";
  if (type === "category") return "dimension_value";
  return type;
}

function document(row, options, embeddingValue, provider) {
  const objectType = normalizeType(row.object_type);
  const searchableText = [
    row.title,
    row.subtitle,
    row.description,
    row.searchable_text,
    row.dataset_code,
    row.source_name,
    JSON.stringify(row.metadata ?? {}),
  ].filter(Boolean).join(" ");
  const investigationId = row.investigation_id ?? null;
  const workspaceId = row.workspace_id ?? null;
  return {
    object_type: objectType,
    object_id: String(row.object_id),
    investigation_id: investigationId,
    workspace_id: workspaceId,
    search_scope_key: scopeKey({ investigation_id: investigationId, workspace_id: workspaceId }),
    object_code: row.object_code ?? row.dataset_code ?? row.measure_code ?? row.geography_code ?? row.category_code ?? row.source_code ?? null,
    primary_name: row.primary_name ?? row.title,
    title: row.title,
    subtitle: row.subtitle ?? null,
    description: row.description ?? null,
    synonyms_text: row.synonyms_text ?? null,
    labels_text: row.labels_text ?? row.subtitle ?? null,
    examples_text: row.examples_text ?? null,
    extended_metadata_text: row.extended_metadata_text ?? JSON.stringify(row.metadata ?? {}),
    searchable_text: searchableText,
    language_code: row.language_code ?? "nl",
    source_name: row.source_name ?? "CBS",
    dataset_key: row.dataset_key ?? row.metadata?.dataset_key ?? null,
    dataset_code: row.dataset_code ?? null,
    unit_code: row.unit_code ?? null,
    topic: row.topic ?? null,
    geography_type: row.geography_type ?? row.metadata?.geography_type ?? null,
    year_start: row.year_start ?? null,
    year_end: row.year_end ?? null,
    metadata: row.metadata ?? {},
    embedding: vectorLiteral(embeddingValue),
    embedding_model: provider.model,
    embedding_version: provider.version,
    source_quality: row.source_quality ?? "source",
    popularity_score: row.popularity_score ?? 0,
  };
}

async function loadSourceDocuments(client, options, provider) {
  const params = [Math.max(1, options.limit)];
  const clauses = [];

  if (options.type) {
    params.push(options.type === "metric" ? "measure" : options.type);
    clauses.push(`ci.object_type = $${params.length}`);
  }
  if (options.dataset) {
    params.push(options.dataset);
    clauses.push(`ci.dataset_code = $${params.length}`);
  }

  const catalogue = await client.query(
    `
      select
        ci.object_type,
        ci.object_id,
        null::uuid as investigation_id,
        null::uuid as workspace_id,
        coalesce(ci.dataset_code, ci.measure_code, ci.geography_code, ci.unit_code) as object_code,
        ci.title as primary_name,
        ci.title,
        ci.subtitle,
        ci.description,
        coalesce(s.synonyms_text, '') as synonyms_text,
        concat_ws(' ', ci.subtitle, ci.tags::text) as labels_text,
        null::text as examples_text,
        ci.metadata::text as extended_metadata_text,
        ci.search_text as searchable_text,
        ci.language_code,
        ci.provider as source_name,
        nullif(ci.metadata->>'dataset_key', '')::bigint as dataset_key,
        ci.dataset_code,
        ci.unit_code,
        coalesce(ci.metadata->>'topic', ci.metadata->>'dimension_code') as topic,
        ci.metadata->>'geography_type' as geography_type,
        nullif(ci.metadata->>'year_start', '')::integer as year_start,
        nullif(ci.metadata->>'year_end', '')::integer as year_end,
        ci.metadata || jsonb_build_object('semantic_catalogue_item_id', ci.catalogue_item_id) as metadata,
        case when ci.provider is not null then 'source' else 'unknown' end as source_quality,
        case ci.object_type when 'dataset' then 30 when 'measure' then 25 when 'geography' then 20 else 10 end as popularity_score
      from semantic.catalogue_item ci
      left join lateral (
        select string_agg(synonym, ' ') as synonyms_text
        from semantic.synonym syn
        where syn.object_id = ci.object_id
          and (
            syn.object_type = ci.object_type
            or (ci.object_type = 'measure' and syn.object_type = 'metric')
            or (ci.object_type in ('category', 'geography') and syn.object_type = 'dimension_value')
          )
      ) s on true
      where ci.is_active
        ${clauses.length ? `and ${clauses.join(" and ")}` : ""}
      order by ci.object_type, ci.title
      limit $1
    `,
    params
  );

  const silverDatasetParams = [Math.max(1, options.limit)];
  const silverDatasetClauses = [];
  if (options.type && options.type !== "dataset") silverDatasetClauses.push("false");
  if (options.dataset) {
    silverDatasetParams.push(options.dataset);
    silverDatasetClauses.push(`d.dataset_id = $${silverDatasetParams.length}`);
  }
  const silverDatasets = await client.query(
    `
      select
        'dataset' as object_type,
        d.dataset_id as object_id,
        null::uuid as investigation_id,
        null::uuid as workspace_id,
        d.dataset_id as object_code,
        coalesce(d.short_title, d.title, d.dataset_id) as primary_name,
        coalesce(d.short_title, d.title, d.dataset_id) as title,
        d.dataset_id as subtitle,
        coalesce(d.short_description, d.title) as description,
        d.dataset_id as synonyms_text,
        concat_ws(' ', d.language, d.catalog, dd.domain_id) as labels_text,
        null::text as examples_text,
        concat_ws(' ', d.period, d.source_version, d.schema_hash) as extended_metadata_text,
        concat_ws(' ', d.dataset_id, d.title, d.short_title, d.short_description, d.catalog, d.period, dd.domain_id) as searchable_text,
        coalesce(nullif(d.language, ''), 'nl') as language_code,
        'CBS' as source_name,
        null::bigint as dataset_key,
        d.dataset_id as dataset_code,
        null::text as unit_code,
        dd.domain_id as topic,
        null::text as geography_type,
        nullif(substring(d.period from '(19[7-9][0-9]|20[0-2][0-9])'), '')::integer as year_start,
        null::integer as year_end,
        jsonb_build_object(
          'dataset_id', d.dataset_id,
          'catalog', d.catalog,
          'period', d.period,
          'source_version', d.source_version,
          'domain_id', dd.domain_id,
          'metadata_origin', 'source'
        ) as metadata,
        'source' as source_quality,
        35 as popularity_score
      from silver.cbs_datasets d
      left join silver.cbs_dataset_domains dd on dd.dataset_id = d.dataset_id
      ${silverDatasetClauses.length ? `where ${silverDatasetClauses.join(" and ")}` : ""}
      order by d.dataset_id
      limit $1
    `,
    silverDatasetParams
  );

  const bronzeDatasetParams = [Math.max(1, options.limit)];
  const bronzeDatasetClauses = [];
  if (options.type && options.type !== "dataset") bronzeDatasetClauses.push("false");
  if (options.dataset) {
    bronzeDatasetParams.push(options.dataset);
    bronzeDatasetClauses.push(`t.identifier = $${bronzeDatasetParams.length}`);
  }
  const bronzeDatasets = await client.query(
    `
      select
        'dataset' as object_type,
        t.identifier as object_id,
        null::uuid as investigation_id,
        null::uuid as workspace_id,
        t.identifier as object_code,
        coalesce(t.short_title, t.title, t.identifier) as primary_name,
        coalesce(t.short_title, t.title, t.identifier) as title,
        t.identifier as subtitle,
        coalesce(t.short_description, t.title) as description,
        t.identifier as synonyms_text,
        concat_ws(' ', t.language, t.catalog) as labels_text,
        null::text as examples_text,
        concat_ws(' ', t.period, t.raw::text) as extended_metadata_text,
        concat_ws(' ', t.identifier, t.title, t.short_title, t.short_description, t.catalog, t.period) as searchable_text,
        coalesce(nullif(t.language, ''), 'nl') as language_code,
        'CBS' as source_name,
        null::bigint as dataset_key,
        t.identifier as dataset_code,
        null::text as unit_code,
        null::text as topic,
        null::text as geography_type,
        nullif(substring(t.period from '(19[7-9][0-9]|20[0-2][0-9])'), '')::integer as year_start,
        null::integer as year_end,
        jsonb_build_object(
          'dataset_id', t.identifier,
          'catalog', t.catalog,
          'period', t.period,
          'metadata_origin', 'source',
          'source_layer', 'bronze'
        ) as metadata,
        'source' as source_quality,
        32 as popularity_score
      from bronze.cbs_catalog_tables t
      ${bronzeDatasetClauses.length ? `where ${bronzeDatasetClauses.join(" and ")}` : ""}
      order by t.identifier
      limit $1
    `,
    bronzeDatasetParams
  );

  const bronzeStatusParams = [Math.max(1, options.limit)];
  const bronzeStatusClauses = [];
  if (options.type && options.type !== "dataset") bronzeStatusClauses.push("false");
  if (options.dataset) {
    bronzeStatusParams.push(options.dataset);
    bronzeStatusClauses.push(`s.dataset_id = $${bronzeStatusParams.length}`);
  }
  const bronzeStatusDatasets = await client.query(
    `
      select
        'dataset' as object_type,
        s.dataset_id as object_id,
        null::uuid as investigation_id,
        null::uuid as workspace_id,
        s.dataset_id as object_code,
        coalesce(s.title, s.dataset_id) as primary_name,
        coalesce(s.title, s.dataset_id) as title,
        s.dataset_id as subtitle,
        s.title as description,
        s.dataset_id as synonyms_text,
        concat_ws(' ', s.status, h.top_theme_title, h.theme_path) as labels_text,
        null::text as examples_text,
        concat_ws(' ', s.record_count::text, s.loaded_row_count::text, s.status, h.top_theme_title, h.theme_path) as extended_metadata_text,
        concat_ws(' ', s.dataset_id, s.title, s.status, h.top_theme_title, h.theme_path) as searchable_text,
        'nl' as language_code,
        'CBS' as source_name,
        null::bigint as dataset_key,
        s.dataset_id as dataset_code,
        null::text as unit_code,
        h.top_theme_title as topic,
        null::text as geography_type,
        null::integer as year_start,
        null::integer as year_end,
        jsonb_build_object(
          'dataset_id', s.dataset_id,
          'status', s.status,
          'record_count', s.record_count,
          'loaded_row_count', s.loaded_row_count,
          'root_theme_title', h.top_theme_title,
          'metadata_origin', 'source',
          'source_layer', 'bronze_status'
        ) as metadata,
        'source' as source_quality,
        34 as popularity_score
      from bronze.cbs_dataset_ingestion_status s
      left join bronze.cbs_dataset_theme_hierarchy h on h.dataset_id = s.dataset_id
      ${bronzeStatusClauses.length ? `where ${bronzeStatusClauses.join(" and ")}` : ""}
      order by s.dataset_id
      limit $1
    `,
    bronzeStatusParams
  );

  const dimensionParams = [Math.max(1, options.limit)];
  const dimensionWhere = options.type && options.type !== "dimension" ? "where false" : "";
  const dimensions = await client.query(
    `
      select
        'dimension' as object_type,
        dimension_id::text as object_id,
        null::uuid as investigation_id,
        null::uuid as workspace_id,
        dimension_code as object_code,
        dimension_name as primary_name,
        dimension_label as title,
        dimension_code as subtitle,
        description,
        null::text as synonyms_text,
        dimension_type as labels_text,
        null::text as examples_text,
        concat_ws(' ', physical_table, physical_key_column, physical_label_column, hierarchy_name) as extended_metadata_text,
        concat_ws(' ', dimension_code, dimension_name, dimension_label, description, dimension_type, hierarchy_name) as searchable_text,
        'nl' as language_code,
        'Guara semantic layer' as source_name,
        null::bigint as dataset_key,
        null::text as dataset_code,
        null::text as unit_code,
        dimension_type as topic,
        case when dimension_type = 'geography' then 'all' else null end as geography_type,
        null::integer as year_start,
        null::integer as year_end,
        jsonb_build_object(
          'dimension_id', dimension_id::text,
          'dimension_code', dimension_code,
          'dimension_type', dimension_type,
          'metadata_origin', metadata_origin,
          'trusted_layer', 'semantic',
          'source_layer', 'semantic',
          'lineage', jsonb_build_object(
            'primary_layer', 'semantic',
            'semantic_table', 'semantic.dimension',
            'semantic_primary_key', dimension_id::text
          )
        ) as metadata,
        metadata_origin as source_quality,
        15 as popularity_score
      from semantic.dimension
      ${dimensionWhere}
      order by dimension_code
      limit $1
    `,
    dimensionParams
  );

  const sourceParams = [Math.max(1, options.limit)];
  const sourceWhere = options.type && options.type !== "source" ? "where false" : "";
  const sources = await client.query(
    `
      select
        'source' as object_type,
        source_key::text as object_id,
        null::uuid as investigation_id,
        null::uuid as workspace_id,
        source_code as object_code,
        source_name as primary_name,
        source_name as title,
        source_code as subtitle,
        source_url as description,
        null::text as synonyms_text,
        source_type as labels_text,
        null::text as examples_text,
        reliability_classification as extended_metadata_text,
        concat_ws(' ', source_code, source_name, source_type, source_url, reliability_classification) as searchable_text,
        'nl' as language_code,
        source_name as source_name,
        null::bigint as dataset_key,
        null::text as dataset_code,
        null::text as unit_code,
        source_type as topic,
        null::text as geography_type,
        null::integer as year_start,
        null::integer as year_end,
        jsonb_build_object(
          'source_key', source_key::text,
          'source_code', source_code,
          'source_type', source_type,
          'trusted_layer', 'semantic',
          'source_layer', 'semantic',
          'lineage', jsonb_build_object(
            'primary_layer', 'semantic',
            'gold_table', 'gold.dim_source',
            'gold_primary_key', source_key::text
          )
        ) as metadata,
        coalesce(reliability_classification, 'source') as source_quality,
        20 as popularity_score
      from gold.dim_source
      ${sourceWhere}
      order by source_code
      limit $1
    `,
    sourceParams
  );

  const investigationRows = [];
  if (!options.type || ["saved_analysis", "evidence", "claim"].includes(options.type)) {
    const investigationFilter = options.investigation ? "and a.answer_id::text = $2" : "";
    const investigationParams = options.investigation ? [Math.max(1, options.limit), options.investigation] : [Math.max(1, options.limit)];
    const analyses = await client.query(
      `
        select
          'saved_analysis' as object_type,
          analysis_id::text as object_id,
          null::uuid as investigation_id,
          null::uuid as workspace_id,
          analysis_id::text as object_code,
          title as primary_name,
          title,
          'Saved analysis' as subtitle,
          summary as description,
          null::text as synonyms_text,
          'saved analysis investigation' as labels_text,
          question as examples_text,
          sources::text as extended_metadata_text,
          concat_ws(' ', title, question, summary, sources::text) as searchable_text,
          'nl' as language_code,
          'Guara' as source_name,
          null::bigint as dataset_key,
          null::text as dataset_code,
          null::text as unit_code,
          null::text as topic,
          null::text as geography_type,
          null::integer as year_start,
          null::integer as year_end,
          jsonb_build_object('analysis_id', analysis_id::text, 'answer_id', answer_id::text) as metadata,
          'curated' as source_quality,
          40 as popularity_score
        from semantic.saved_analysis a
        where true ${investigationFilter}
        order by created_at desc
        limit $1
      `,
      investigationParams
    );
    investigationRows.push(...analyses.rows);
  }

  const sourceRows = [...catalogue.rows, ...silverDatasets.rows, ...bronzeDatasets.rows, ...bronzeStatusDatasets.rows, ...dimensions.rows, ...sources.rows, ...investigationRows];
  const embeddingInputs = sourceRows.map((row) => [
    row.description,
    row.searchable_text,
    row.extended_metadata_text,
    row.examples_text,
  ].filter(Boolean).join(" "));
  const embeddings = await provider.embedTexts(embeddingInputs);
  return sourceRows
    .map((row, index) => document(row, options, embeddings[index], provider))
    .filter((row) => !options.type || row.object_type === options.type);
}

function chunkRows(rows, size) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += Math.max(1, size)) chunks.push(rows.slice(index, index + Math.max(1, size)));
  return chunks;
}

async function upsertDocuments(client, docs, options) {
  let count = 0;
  const deduped = Array.from(new Map(docs.map((row) => [`${row.object_type}:${row.object_id}:${row.search_scope_key}`, row])).values());
  for (const chunk of chunkRows(deduped, options.batchSize)) {
    await client.query(
      `
        insert into search.search_document (
          object_type, object_id, investigation_id, workspace_id, search_scope_key, object_code, primary_name,
          title, subtitle, description, synonyms_text, labels_text, examples_text, extended_metadata_text,
          searchable_text, language_code, source_name, dataset_key, dataset_code, unit_code, topic, geography_type,
          year_start, year_end, metadata, embedding, embedding_model, embedding_version, source_quality,
          popularity_score, updated_at, indexed_at
        )
        select *
        from jsonb_to_recordset($1::jsonb) as row(
          object_type text,
          object_id text,
          investigation_id uuid,
          workspace_id uuid,
          search_scope_key text,
          object_code text,
          primary_name text,
          title text,
          subtitle text,
          description text,
          synonyms_text text,
          labels_text text,
          examples_text text,
          extended_metadata_text text,
          searchable_text text,
          language_code text,
          source_name text,
          dataset_key bigint,
          dataset_code text,
          unit_code text,
          topic text,
          geography_type text,
          year_start integer,
          year_end integer,
          metadata jsonb,
          embedding vector(64),
          embedding_model text,
          embedding_version text,
          source_quality text,
          popularity_score numeric,
          updated_at timestamptz,
          indexed_at timestamptz
        )
        on conflict (object_type, object_id, search_scope_key) do update set
          investigation_id = excluded.investigation_id,
          workspace_id = excluded.workspace_id,
          object_code = excluded.object_code,
          primary_name = excluded.primary_name,
          title = excluded.title,
          subtitle = excluded.subtitle,
          description = excluded.description,
          synonyms_text = excluded.synonyms_text,
          labels_text = excluded.labels_text,
          examples_text = excluded.examples_text,
          extended_metadata_text = excluded.extended_metadata_text,
          searchable_text = excluded.searchable_text,
          language_code = excluded.language_code,
          source_name = excluded.source_name,
          dataset_key = excluded.dataset_key,
          dataset_code = excluded.dataset_code,
          unit_code = excluded.unit_code,
          topic = excluded.topic,
          geography_type = excluded.geography_type,
          year_start = excluded.year_start,
          year_end = excluded.year_end,
          metadata = excluded.metadata,
          embedding = excluded.embedding,
          embedding_model = excluded.embedding_model,
          embedding_version = excluded.embedding_version,
          source_quality = excluded.source_quality,
          popularity_score = excluded.popularity_score,
          updated_at = now(),
          indexed_at = now()
      `,
      [JSON.stringify(chunk.map((row) => ({ ...row, updated_at: new Date().toISOString(), indexed_at: new Date().toISOString() })))]
    );
    count += chunk.length;
  }
  return count;
}

async function removeStaleDocuments(client, docs, options) {
  if (!options.full) return 0;
  if (!docs.length) return 0;
  const keys = docs.map((row) => `${row.object_type}:${row.object_id}:${row.search_scope_key}`);
  const params = [keys];
  const clauses = [`concat(object_type, ':', object_id, ':', search_scope_key) <> all($1::text[])`];
  if (options.type) {
    params.push(options.type);
    clauses.push(`object_type = $${params.length}`);
  }
  if (options.dataset) {
    params.push(options.dataset);
    clauses.push(`dataset_code = $${params.length}`);
  }
  if (options.investigation) {
    params.push(options.investigation);
    clauses.push(`investigation_id = $${params.length}::uuid`);
  } else {
    clauses.push("investigation_id is null");
  }
  const result = await client.query(`delete from search.search_document where ${clauses.join(" and ")}`, params);
  return result.rowCount ?? 0;
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const runId = randomUUID();
  const embeddingProvider = new LocalHashEmbeddingProvider({ version: options.embeddingVersion });
  const client = createPostgresClient({
    applicationName: "guara-search-indexer",
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
    await client.query(
      `
        insert into search.index_runs (
          index_run_id, status, mode, object_type, dataset_code, investigation_id, embedding_model, embedding_version, message
        )
        values ($1, 'pending', $2, $3, $4, $5, $6, $7, 'Indexing search documents.')
      `,
      [
        runId,
        options.full ? "full" : "incremental",
        options.type || null,
        options.dataset || null,
        options.investigation || null,
        embeddingProvider.model,
        embeddingProvider.version,
      ]
    );

    const docs = await loadSourceDocuments(client, options, embeddingProvider);
    const indexed = await upsertDocuments(client, docs, options);
    const removed = await removeStaleDocuments(client, docs, options);

    await client.query(
      `
        update search.index_runs
        set status = 'complete',
          indexed_count = $2,
          removed_count = $3,
          finished_at = now(),
          message = 'Search indexing complete.'
        where index_run_id = $1
      `,
      [runId, indexed, removed]
    );
    console.log(`Indexed ${indexed} search document(s), removed ${removed} stale document(s).`);
  } catch (error) {
    await client.query(
      "update search.index_runs set status = 'failed', failure_count = 1, finished_at = now(), message = $2 where index_run_id = $1",
      [runId, error.message]
    ).catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(explainPostgresConnectionError(error));
    process.exit(1);
  });
}
