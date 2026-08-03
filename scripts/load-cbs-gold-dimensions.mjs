#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv, normalizeKey } from "./lib/runtime.mjs";
import {
  geographyTypeFromCode,
  inferAggregation,
  inferValueType,
  normalizeUnit,
  safeIsoDate,
  safeIsoTimestamp,
  stableBigInt,
} from "./lib/cbs-gold-utils.mjs";

function parseArgs(argv) {
  const options = {
    dataset: "",
    domain: "",
    rootTheme: "",
    limit: 100,
    ensureSchema: false,
    includeEmpty: false,
    writeTimeoutMs: 900000,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dataset") options.dataset = argv[++index] ?? "";
    else if (arg === "--domain") options.domain = argv[++index] ?? "";
    else if (arg === "--root-theme") options.rootTheme = argv[++index] ?? "";
    else if (arg === "--limit") options.limit = Number(argv[++index] ?? options.limit);
    else if (arg === "--ensure-schema") options.ensureSchema = true;
    else if (arg === "--include-empty") options.includeEmpty = true;
    else if (arg === "--write-timeout-ms") options.writeTimeoutMs = Number(argv[++index] ?? options.writeTimeoutMs);
    else if (arg === "--help") {
      console.log(`Usage:
  npm run load:cbs:gold:dimensions -- --domain bouwen-en-wonen --limit 100
  npm run load:cbs:gold:dimensions -- --root-theme "Bouwen en wonen" --limit 100
  npm run load:cbs:gold:dimensions -- --dataset 85039NED

Options:
  --ensure-schema              Execute supabase/gold_schema.sql before loading.
  --domain bouwen-en-wonen     Load conformed dimensions for one Guara/CBS domain.
  --root-theme "Bouwen..."     Load conformed dimensions for one CBS root theme.
  --dataset 85039NED           Load conformed dimensions for one Silver dataset.
  --limit 100                  Maximum datasets to process.
  --include-empty              Include datasets with zero Silver observations.
`);
      process.exit(0);
    }
  }

  return options;
}

function loadCbsDomains() {
  return JSON.parse(readFileSync(resolve(process.cwd(), "config/cbs-domains.json"), "utf8"));
}

function resolveRootTheme(options) {
  if (options.rootTheme) return options.rootTheme;
  if (!options.domain) return "";
  const normalized = normalizeKey(options.domain);
  const domain = loadCbsDomains().find((item) =>
    [item.domain_id, item.canonical_name, item.cbs_root_theme_title, ...(item.aliases ?? [])].some(
      (candidate) => normalizeKey(candidate) === normalized
    )
  );
  if (!domain) throw new Error(`Unknown CBS domain "${options.domain}".`);
  return domain.cbs_root_theme_title;
}

async function ensureSchema(client) {
  await client.query(readFileSync(resolve(process.cwd(), "supabase/gold_schema.sql"), "utf8"));
}

async function upsertOne(client, sql, params, keyColumn) {
  const result = await client.query(sql, params);
  return result.rows[0][keyColumn];
}

async function getDatasets(client, options) {
  if (options.dataset) {
    const result = await client.query(
      `
        select d.*
        from silver.cbs_datasets d
        where d.dataset_id = $1
      `,
      [options.dataset]
    );
    return result.rows;
  }

  const rootTheme = resolveRootTheme(options);
  const params = [Math.max(1, options.limit)];
  let themeJoin = "";
  let themeWhere = "";

  if (rootTheme) {
    params.push(rootTheme);
    themeJoin = "join silver.cbs_dataset_domains dd on dd.dataset_id = d.dataset_id";
    themeWhere = `and lower(dd.root_theme_title) = lower($${params.length})`;
  }

  const observationsWhere = options.includeEmpty ? "" : "and coalesce(s.observations_loaded, 0) > 0";

  const result = await client.query(
    `
      select distinct d.*
      from silver.cbs_datasets d
      left join silver.cbs_dataset_load_status s on s.dataset_id = d.dataset_id
      ${themeJoin}
      where 1 = 1
        ${themeWhere}
        ${observationsWhere}
      order by d.dataset_id
      limit $1
    `,
    params
  );
  return result.rows;
}

async function upsertSource(client) {
  await client.query(
    `
      insert into gold.dim_source (source_key, source_code, source_name, source_type, source_url)
      values ($1, 'CBS', 'Centraal Bureau voor de Statistiek', 'government', 'https://www.cbs.nl')
      on conflict (source_code) do update set
        source_name = excluded.source_name,
        source_type = excluded.source_type,
        source_url = excluded.source_url,
        updated_at = now()
    `,
    [stableBigInt(["source", "CBS"])]
  );
}

async function upsertDataset(client, dataset) {
  return upsertOne(
    client,
    `
      insert into gold.dim_dataset (
        dataset_key, dataset_code, dataset_title, dataset_description, source_organization,
        source_system, source_url, dataset_version, publication_date, last_updated_at_source, loaded_at, is_active
      )
      values ($1,$2,$3,$4,'CBS','CBS',$5,$6,$7,$8,now(),true)
      on conflict (source_system, dataset_code, dataset_version) do update set
        dataset_title = excluded.dataset_title,
        dataset_description = excluded.dataset_description,
        source_url = excluded.source_url,
        last_updated_at_source = excluded.last_updated_at_source,
        loaded_at = excluded.loaded_at,
        is_active = true,
        updated_at = now()
      returning dataset_key
    `,
    [
      stableBigInt(["dataset", "CBS", dataset.dataset_id, dataset.source_version || dataset.cbs_updated_at || "unknown"]),
      dataset.dataset_id,
      dataset.short_title || dataset.title || dataset.dataset_id,
      dataset.short_description || dataset.title || null,
      `https://opendata.cbs.nl/ODataApi/odata/${dataset.dataset_id}`,
      dataset.source_version || dataset.cbs_updated_at || "unknown",
      safeIsoDate(dataset.cbs_updated_at),
      safeIsoTimestamp(dataset.cbs_updated_at),
    ],
    "dataset_key"
  );
}

async function getDatasetGrain(client, datasetId) {
  const result = await client.query(
    "select period_dimension_key, spatial_dimension_keys from silver.cbs_dataset_grain where dataset_id = $1",
    [datasetId]
  );
  return result.rows[0] ?? { period_dimension_key: "Perioden", spatial_dimension_keys: [] };
}

async function loadDates(client, datasetId) {
  const result = await client.query("select * from silver.cbs_period_values where dataset_id = $1", [datasetId]);
  let count = 0;

  for (const row of result.rows) {
    await client.query(
      `
        insert into gold.dim_date (
          date_key, period_code, period_type, calendar_year, calendar_quarter, calendar_month,
          period_start_date, period_end_date, period_label, is_complete_period, source_period_value
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10)
        on conflict (period_code, period_type) do update set
          calendar_year = excluded.calendar_year,
          calendar_quarter = excluded.calendar_quarter,
          calendar_month = excluded.calendar_month,
          period_start_date = excluded.period_start_date,
          period_end_date = excluded.period_end_date,
          period_label = excluded.period_label,
          source_period_value = excluded.source_period_value,
          updated_at = now()
      `,
      [
        stableBigInt(["date", row.period_key, row.period_type || "other"]),
        row.period_key,
        row.period_type || "other",
        row.year ?? null,
        row.period_type === "quarter" ? Number(String(row.period_key).match(/KW(\d{2})/)?.[1] ?? null) : null,
        row.period_type === "month" ? Number(String(row.period_key).match(/MM(\d{2})/)?.[1] ?? null) : null,
        row.period_start_date,
        row.period_end_date,
        row.label || row.period_key,
        row.source_value || row.period_key,
      ]
    );
    count += 1;
  }

  return count;
}

async function loadGeographies(client, datasetId) {
  const result = await client.query("select * from silver.cbs_region_values where dataset_id = $1", [datasetId]);
  let count = 0;

  for (const row of result.rows) {
    const geographyType = geographyTypeFromCode(row.region_code, row.region_level || "unknown");
    await client.query(
      `
        insert into gold.dim_geography (
          geography_key, geography_code, geography_name, geography_type, municipality_code,
          province_code, country_code, valid_from, valid_to, is_current, source_system
        )
        values ($1,$2,$3,$4,$5,$6,'NL',$7,$8,$9,'CBS')
        on conflict (source_system, geography_type, geography_code, valid_from) do update set
          geography_name = excluded.geography_name,
          municipality_code = excluded.municipality_code,
          province_code = excluded.province_code,
          valid_to = excluded.valid_to,
          is_current = excluded.is_current,
          updated_at = now()
      `,
      [
        stableBigInt(["geography", "CBS", geographyType, row.region_code, row.valid_from || "1900-01-01"]),
        row.region_code,
        row.region_name || row.region_code,
        geographyType,
        row.municipality_code,
        row.province_code,
        row.valid_from || "1900-01-01",
        row.valid_to,
        row.valid_to ? false : true,
      ]
    );
    count += 1;
  }

  return count;
}

async function getUnitKey(client, unitCode) {
  const result = await client.query("select unit_key from gold.dim_unit where unit_code = $1", [unitCode]);
  return result.rows[0]?.unit_key ?? -1;
}

async function loadMeasures(client, dataset) {
  const result = await client.query(
    `
      select m.*, i.topic_path
      from silver.cbs_measures m
      left join silver.cbs_indicator_candidates i
        on i.dataset_id = m.dataset_id and i.measure_key = m.measure_key
      where m.dataset_id = $1
      order by m.measure_key
    `,
    [dataset.dataset_id]
  );
  let count = 0;

  for (const row of result.rows) {
    const unitCode = normalizeUnit(row.unit, row.title || row.measure_key);
    const unitKey = await getUnitKey(client, unitCode);
    const aggregation = inferAggregation(row.unit, row.title || row.measure_key);
    const isAdditive = aggregation === "sum";
    const topicParts = String(row.topic_path ?? "").split(">").map((part) => part.trim()).filter(Boolean);

    await client.query(
      `
        insert into gold.dim_measure (
          measure_key, measure_code, measure_name, measure_description, topic, subtopic,
          unit_key, default_aggregation, is_additive, is_semi_additive, is_non_additive,
          value_type, decimals, source_system, dataset_code
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10,$11,$12,'CBS',$13)
        on conflict (source_system, dataset_code, measure_code) do update set
          measure_name = excluded.measure_name,
          measure_description = excluded.measure_description,
          topic = excluded.topic,
          subtopic = excluded.subtopic,
          unit_key = excluded.unit_key,
          default_aggregation = excluded.default_aggregation,
          is_additive = excluded.is_additive,
          is_non_additive = excluded.is_non_additive,
          value_type = excluded.value_type,
          decimals = excluded.decimals,
          updated_at = now()
      `,
      [
        stableBigInt(["measure", "CBS", dataset.dataset_id, row.measure_key]),
        row.measure_key,
        row.title || row.measure_key,
        row.description ?? null,
        topicParts[0] ?? null,
        topicParts.at(-1) ?? null,
        unitKey,
        aggregation,
        isAdditive,
        !isAdditive,
        inferValueType(row.unit, row.title || row.measure_key),
        row.decimals ?? null,
        dataset.dataset_id,
      ]
    );
    count += 1;
  }

  return count;
}

function isTotalCategory(code, name) {
  const text = `${code ?? ""} ${name ?? ""}`.toLowerCase();
  return text.includes("totaal") || text.includes("total");
}

async function loadCategories(client, datasetKey, datasetId, primaryDimensionKeys) {
  const result = await client.query("select * from silver.cbs_dimension_values where dataset_id = $1", [datasetId]);
  const dimensions = new Set();
  let count = 0;

  for (const row of result.rows) {
    if (primaryDimensionKeys.has(row.dimension_key)) continue;
    dimensions.add(row.dimension_key);
    await client.query(
      `
        insert into gold.dim_category (
          category_key, dataset_key, dimension_code, category_code, category_name,
          category_description, is_total, is_unknown
        )
        values ($1,$2,$3,$4,$5,$6,$7,false)
        on conflict (dataset_key, dimension_code, category_code) do update set
          category_name = excluded.category_name,
          category_description = excluded.category_description,
          is_total = excluded.is_total,
          updated_at = now()
      `,
      [
        stableBigInt(["category", datasetKey, row.dimension_key, row.value_key]),
        datasetKey,
        row.dimension_key,
        row.value_key,
        row.title || row.value_key,
        row.description ?? null,
        isTotalCategory(row.value_key, row.title),
      ]
    );
    count += 1;
  }

  for (const dimensionCode of dimensions) {
    await client.query(
      `
        insert into gold.dim_category (
          category_key, dataset_key, dimension_code, category_code, category_name, is_unknown
        )
        values ($1,$2,$3,'UNKNOWN','Unknown category',true)
        on conflict (dataset_key, dimension_code, category_code) do update set updated_at = now()
      `,
      [stableBigInt(["category", datasetKey, dimensionCode, "UNKNOWN"]), datasetKey, dimensionCode]
    );
    count += 1;
  }

  return count;
}

async function loadDatasetDimensions(client, dataset) {
  await client.query("begin");
  try {
    await upsertSource(client);
    const datasetKey = await upsertDataset(client, dataset);
    const grain = await getDatasetGrain(client, dataset.dataset_id);
    const periodDimensionKey = grain.period_dimension_key || "Perioden";
    const spatialDimensionKeys = new Set(grain.spatial_dimension_keys ?? []);
    const primaryDimensionKeys = new Set([periodDimensionKey, ...spatialDimensionKeys]);

    const dates = await loadDates(client, dataset.dataset_id);
    const geographies = await loadGeographies(client, dataset.dataset_id);
    const measures = await loadMeasures(client, dataset);
    const categories = await loadCategories(client, datasetKey, dataset.dataset_id, primaryDimensionKeys);

    await client.query("commit");
    return { dates, geographies, measures, categories };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  }
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const selectionClient = createPostgresClient({
    applicationName: "guara-cbs-gold-dimension-loader",
    statementTimeoutMs: Math.max(1, options.writeTimeoutMs),
    queryTimeoutMs: Math.max(1, options.writeTimeoutMs),
  });

  try {
    await selectionClient.connect();
  } catch (error) {
    throw new Error(explainPostgresConnectionError(error));
  }

  const runId = randomUUID();
  const summary = { datasets: 0, dates: 0, geographies: 0, measures: 0, categories: 0, failed: 0 };

  try {
    if (options.ensureSchema) await ensureSchema(selectionClient);
    const datasets = await getDatasets(selectionClient, options);
    console.log(`Found ${datasets.length} Silver dataset(s) for conformed Gold dimensions. Run ${runId}`);
    await selectionClient.end();

    for (const dataset of datasets) {
      const datasetClient = createPostgresClient({
        applicationName: `guara-cbs-gold-dimensions-${dataset.dataset_id}`,
        statementTimeoutMs: Math.max(1, options.writeTimeoutMs),
        queryTimeoutMs: Math.max(1, options.writeTimeoutMs),
      });
      try {
        await datasetClient.connect();
        const result = await loadDatasetDimensions(datasetClient, dataset);
        summary.datasets += 1;
        summary.dates += result.dates;
        summary.geographies += result.geographies;
        summary.measures += result.measures;
        summary.categories += result.categories;
        console.log(
          `Dimensions ${dataset.dataset_id}: ${result.dates} dates, ${result.geographies} geographies, ${result.measures} measures, ${result.categories} categories`
        );
      } catch (error) {
        summary.failed += 1;
        console.error(`Failed dimensions for ${dataset.dataset_id}: ${error.message}`);
      } finally {
        await datasetClient.end().catch(() => {});
      }
    }

    console.log(`Conformed dimension load summary: ${JSON.stringify(summary)}`);
    if (summary.failed > 0) process.exitCode = 1;
  } finally {
    await selectionClient.end().catch(() => {});
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
