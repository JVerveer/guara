#!/usr/bin/env node
import { LocalHashEmbeddingProvider, vectorLiteral } from "./lib/embedding-provider.mjs";
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

const DEFAULT_QUERIES = [
  "woningvoorraad per gemeente",
  "nieuwbouw woningen 2023",
  "house prices Utrecht",
  "building permits Amsterdam",
  "huurwoningen Rotterdam",
  "Bouwen en wonen datasets",
];

function parseArgs(argv) {
  const options = { limit: 5, queries: [], noEmbedding: false, timeoutMs: 120000, strictGoldOnly: true };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--query") options.queries.push(argv[++index] ?? "");
    else if (arg === "--limit") options.limit = Number(argv[++index] ?? options.limit);
    else if (arg === "--no-embedding") options.noEmbedding = true;
    else if (arg === "--include-non-gold") options.strictGoldOnly = false;
    else if (arg === "--timeout-ms") options.timeoutMs = Number(argv[++index] ?? options.timeoutMs);
    else if (arg === "--help") {
      console.log(`Usage:
  npm run test:search:bouwen-en-wonen
  npm run test:search:bouwen-en-wonen -- --query "woningvoorraad Amsterdam"
  npm run test:search:bouwen-en-wonen -- --no-embedding

Runs lightweight Bouwen en wonen search smoke tests against search.search_document.
It does not scan the large fact table.
`);
      process.exit(0);
    }
  }
  return options;
}

async function getStatus(client) {
  const result = await client.query(`
    select
      (select count(*)::bigint from gold_bouwen_wonen.dim_housing_dataset) as mart_datasets,
      (select count(*)::bigint from gold_bouwen_wonen.dim_housing_indicator) as mart_indicators,
      (select count(*)::bigint from semantic.metric m join gold_bouwen_wonen.dim_housing_indicator i on i.measure_key = m.measure_key where m.is_enabled) as enabled_housing_metrics,
      (select count(*)::bigint from search.search_document where metadata->>'domain_id' = 'bouwen-en-wonen') as indexed_domain_documents,
      (select reltuples::bigint from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'gold_bouwen_wonen' and c.relname = 'fact_housing_observation') as estimated_fact_rows
  `);
  return result.rows[0];
}

async function runSearch(client, provider, query, options) {
  const embedding = options.noEmbedding ? null : vectorLiteral(provider.embedText(query));
  const objectTypes = /\bdatasets?\b/i.test(query)
    ? ["dataset"]
    : ["dataset", "metric", "dimension", "dimension_value", "geography", "source"];
  const result = await client.query(
    `
      select object_type, title, subtitle, dataset_code, rank_score, result_reason, metadata
      from public.guara_search_documents($1, $2, $3, $4, null, $5::jsonb, true)
    `,
    [
      query,
      embedding,
      options.limit,
      objectTypes,
      JSON.stringify({ domain_id: "bouwen-en-wonen", strict_gold_only: options.strictGoldOnly }),
    ]
  );
  return result.rows;
}

async function main() {
  const options = parseArgs(process.argv);
  loadLocalEnv();
  const client = createPostgresClient({
    applicationName: "guara-test-bouwen-wonen-search",
    statementTimeoutMs: options.timeoutMs,
    queryTimeoutMs: options.timeoutMs,
  });
  const provider = new LocalHashEmbeddingProvider();

  try {
    await client.connect();
    const status = await getStatus(client);
    console.log("Bouwen en wonen search status");
    console.table(status);

    for (const query of options.queries.length ? options.queries : DEFAULT_QUERIES) {
      console.log(`\nQuery: ${query}`);
      const rows = await runSearch(client, provider, query, options);
      if (!rows.length) {
        console.log("No results.");
        continue;
      }
      console.table(rows.map((row) => ({
        type: row.object_type,
        title: row.title,
        dataset: row.dataset_code,
        score: row.rank_score,
        reason: row.result_reason,
        hasFactData: row.metadata?.has_fact_data ?? null,
        trustedLayer: row.metadata?.trusted_layer ?? null,
        sourceLayer: row.metadata?.source_layer ?? null,
        sourceUpdated: row.metadata?.source_last_updated_at ?? null,
        goldLoaded: row.metadata?.gold_loaded_at ?? null,
        silverLoaded: row.metadata?.silver_loaded_at ?? null,
        metricCode: row.metadata?.metric_code ?? null,
      })));
    }
  } catch (error) {
    console.error(explainPostgresConnectionError(error));
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
