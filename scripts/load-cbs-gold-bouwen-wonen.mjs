#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";
import {
  categoryCombinationHash,
  classifyMissing,
  geographyTypeFromCode,
  inferAggregation,
  inferValueType,
  normalizeUnit,
  numericValue,
  safeIsoDate,
  safeIsoTimestamp,
  stableBigInt,
  stableHash,
} from "./load-cbs-gold.mjs";

function parseArgs(argv) {
  const options = {
    ensureSchema: false,
    refresh: false,
    resume: true,
    dataset: "",
    limit: 100,
    batchSize: 50000,
    writeBatchSize: 50000,
    writeTimeoutMs: 900000,
    lookupChunkSize: 5000,
    maxBatches: 0,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--ensure-schema") options.ensureSchema = true;
    else if (arg === "--refresh") options.refresh = true;
    else if (arg === "--no-resume") options.resume = false;
    else if (arg === "--dataset") options.dataset = argv[++index] ?? "";
    else if (arg === "--limit") options.limit = Number(argv[++index] ?? options.limit);
    else if (arg === "--batch-size") options.batchSize = Number(argv[++index] ?? options.batchSize);
    else if (arg === "--write-batch-size") options.writeBatchSize = Number(argv[++index] ?? options.writeBatchSize);
    else if (arg === "--write-timeout-ms") options.writeTimeoutMs = Number(argv[++index] ?? options.writeTimeoutMs);
    else if (arg === "--lookup-chunk-size") options.lookupChunkSize = Number(argv[++index] ?? options.lookupChunkSize);
    else if (arg === "--max-batches") options.maxBatches = Number(argv[++index] ?? options.maxBatches);
    else if (arg === "--help") {
      console.log(`Usage:
  npm run load:cbs:gold:bouwen-en-wonen -- --ensure-schema --limit 100
  npm run load:cbs:gold:bouwen-en-wonen -- --dataset 85039NED
  npm run load:cbs:gold:bouwen-en-wonen -- --refresh

Options:
  --ensure-schema       Execute generic Gold and Bouwen en wonen schemas before loading.
  --dataset 85039NED    Load one Bouwen en wonen dataset from Silver.
  --limit 100           Maximum Bouwen en wonen Silver datasets to load.
  --batch-size 50000    Silver observations read per batch.
  --lookup-chunk-size   Silver row ids per dimensions/measures lookup chunk.
  --write-batch-size    Domain fact rows written per insert chunk.
  --max-batches 1       Stop after N read batches; useful for smoke tests.
  --no-resume           Reprocess selected datasets instead of skipping/resuming Gold facts.
  --refresh             Rebuild selected mart facts from Silver.
`);
      process.exit(0);
    }
  }

  return options;
}

async function ensureSchema(client) {
  await client.query(readFileSync(resolve(process.cwd(), "supabase/gold_schema.sql"), "utf8"));
  await client.query(readFileSync(resolve(process.cwd(), "supabase/gold_bouwen_wonen_schema.sql"), "utf8"));
}

async function ensureRuntimeTables(client) {
  await client.query(`
    create table if not exists gold_bouwen_wonen.dataset_load_progress (
      dataset_key bigint primary key references gold.dim_dataset(dataset_key),
      dataset_code text not null,
      status text not null default 'pending',
      next_row_index bigint not null default 0,
      source_rows_loaded bigint not null default 0,
      fact_rows_loaded bigint not null default 0,
      bridge_rows_loaded bigint not null default 0,
      started_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      completed_at timestamptz,
      last_error text
    )
  `);
}

function chunkRows(rows, size) {
  const chunks = [];
  const chunkSize = Math.max(1, size);
  for (let index = 0; index < rows.length; index += chunkSize) chunks.push(rows.slice(index, index + chunkSize));
  return chunks;
}

async function upsertOne(client, sql, params, keyColumn) {
  const result = await client.query(sql, params);
  return result.rows[0][keyColumn];
}

async function getUnitKey(client, unitCode) {
  const result = await client.query("select unit_key from gold.dim_unit where unit_code = $1", [unitCode]);
  return result.rows[0]?.unit_key ?? -1;
}

async function getDatasets(client, options) {
  const params = [Math.max(1, options.limit)];
  const datasetWhere = options.dataset ? "and d.dataset_id = $2" : "";
  if (options.dataset) params.push(options.dataset);

  const result = await client.query(
    `
      select distinct d.*
      from silver.cbs_datasets d
      join silver.cbs_dataset_load_status s on s.dataset_id = d.dataset_id
      join silver.cbs_dataset_domains dd on dd.dataset_id = d.dataset_id
      where dd.domain_id = 'bouwen-en-wonen'
        and s.observations_loaded > 0
        and s.status in ('complete', 'complete_with_warnings', 'partial')
        ${datasetWhere}
      order by d.dataset_id
      limit $1
    `,
    params
  );
  return result.rows;
}

async function upsertDataset(client, dataset) {
  const datasetKey = await upsertOne(
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

  await client.query(
    `
      insert into gold_bouwen_wonen.dim_housing_dataset (
        housing_dataset_key, dataset_key, dataset_code, dataset_title, dataset_version,
        source_system, source_url, source_organization, last_updated_at_source
      )
      select dataset_key, dataset_key, dataset_code, dataset_title, dataset_version,
        source_system, source_url, source_organization, last_updated_at_source
      from gold.dim_dataset
      where dataset_key = $1
      on conflict (dataset_key) do update set
        dataset_code = excluded.dataset_code,
        dataset_title = excluded.dataset_title,
        dataset_version = excluded.dataset_version,
        source_system = excluded.source_system,
        source_url = excluded.source_url,
        source_organization = excluded.source_organization,
        last_updated_at_source = excluded.last_updated_at_source,
        updated_at = now()
    `,
    [datasetKey]
  );

  return datasetKey;
}

async function getDatasetGrain(client, datasetId) {
  const result = await client.query(
    "select period_dimension_key, spatial_dimension_keys from silver.cbs_dataset_grain where dataset_id = $1",
    [datasetId]
  );
  return result.rows[0] ?? { period_dimension_key: "Perioden", spatial_dimension_keys: [] };
}

async function getDatasetFactCounts(client, datasetId, datasetKey) {
  const result = await client.query(
    `
      select
        (select count(*)::bigint from silver.cbs_observation_measures where dataset_id = $1) as expected_fact_rows,
        (select count(*)::bigint from gold_bouwen_wonen.fact_housing_observation where housing_dataset_key = $2) as loaded_fact_rows
    `,
    [datasetId, datasetKey]
  );
  return {
    expectedFactRows: BigInt(result.rows[0]?.expected_fact_rows ?? 0),
    loadedFactRows: BigInt(result.rows[0]?.loaded_fact_rows ?? 0),
  };
}

async function getLastSilverObservation(client, datasetId) {
  const result = await client.query(
    `
      select row_id, row_index
      from silver.cbs_observations
      where dataset_id = $1
      order by row_index desc
      limit 1
    `,
    [datasetId]
  );
  return result.rows[0] ?? null;
}

async function getLastSilverObservationLoadState(client, datasetId, datasetKey) {
  const lastObservation = await getLastSilverObservation(client, datasetId);
  if (!lastObservation) {
    return {
      isComplete: false,
      lastObservation: null,
      expectedLastRowFacts: 0n,
      loadedLastRowFacts: 0n,
    };
  }

  const result = await client.query(
    `
      select
        (select count(*)::bigint
         from silver.cbs_observation_measures
         where dataset_id = $1 and row_id = $2) as expected_last_row_facts,
        (select count(*)::bigint
         from gold_bouwen_wonen.fact_housing_observation
         where housing_dataset_key = $3 and source_row_id = $2) as loaded_last_row_facts
    `,
    [datasetId, lastObservation.row_id, datasetKey]
  );

  const expectedLastRowFacts = BigInt(result.rows[0]?.expected_last_row_facts ?? 0);
  const loadedLastRowFacts = BigInt(result.rows[0]?.loaded_last_row_facts ?? 0);
  return {
    isComplete: expectedLastRowFacts > 0n && loadedLastRowFacts >= expectedLastRowFacts,
    lastObservation,
    expectedLastRowFacts,
    loadedLastRowFacts,
  };
}

async function hasFirstGoldRowForDataset(client, datasetKey) {
  const result = await client.query(
    `
      select 1
      from gold_bouwen_wonen.fact_housing_observation
      where housing_dataset_key = $1
        and source_row_id = '0'
      limit 1
    `,
    [datasetKey]
  );
  return result.rowCount > 0;
}

async function getResumeRowIndex(client, datasetId, datasetKey) {
  const result = await client.query(
    `
      select coalesce(max(o.row_index) + 1, 0) as resume_row_index
      from silver.cbs_observations o
      where o.dataset_id = $1
        and exists (
          select 1
          from gold_bouwen_wonen.fact_housing_observation f
          where f.housing_dataset_key = $2
            and f.source_row_id = o.row_id
        )
    `,
    [datasetId, datasetKey]
  );
  return Number(result.rows[0]?.resume_row_index ?? 0);
}

async function getDatasetProgress(client, datasetKey) {
  const result = await client.query(
    `
      select *
      from gold_bouwen_wonen.dataset_load_progress
      where dataset_key = $1
    `,
    [datasetKey]
  );
  return result.rows[0] ?? null;
}

async function upsertDatasetProgress(client, {
  datasetKey,
  datasetCode,
  status,
  nextRowIndex = 0,
  sourceRowsLoaded = 0,
  factRowsLoaded = 0,
  bridgeRowsLoaded = 0,
  completed = false,
  lastError = null,
}) {
  await client.query(
    `
      insert into gold_bouwen_wonen.dataset_load_progress (
        dataset_key, dataset_code, status, next_row_index, source_rows_loaded,
        fact_rows_loaded, bridge_rows_loaded, completed_at, last_error
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      on conflict (dataset_key) do update set
        dataset_code = excluded.dataset_code,
        status = excluded.status,
        next_row_index = excluded.next_row_index,
        source_rows_loaded = gold_bouwen_wonen.dataset_load_progress.source_rows_loaded + excluded.source_rows_loaded,
        fact_rows_loaded = gold_bouwen_wonen.dataset_load_progress.fact_rows_loaded + excluded.fact_rows_loaded,
        bridge_rows_loaded = gold_bouwen_wonen.dataset_load_progress.bridge_rows_loaded + excluded.bridge_rows_loaded,
        completed_at = coalesce(excluded.completed_at, gold_bouwen_wonen.dataset_load_progress.completed_at),
        last_error = excluded.last_error,
        updated_at = now()
    `,
    [
      datasetKey,
      datasetCode,
      status,
      nextRowIndex,
      sourceRowsLoaded,
      factRowsLoaded,
      bridgeRowsLoaded,
      completed ? new Date().toISOString() : null,
      lastError,
    ]
  );
}

async function upsertDates(client, datasetId) {
  const result = await client.query("select * from silver.cbs_period_values where dataset_id = $1", [datasetId]);
  const map = new Map();

  for (const row of result.rows) {
    const dateKey = await upsertOne(
      client,
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
        returning date_key
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
      ],
      "date_key"
    );
    map.set(row.period_key, dateKey);
  }

  return map;
}

async function upsertGeographies(client, datasetId) {
  const result = await client.query("select * from silver.cbs_region_values where dataset_id = $1", [datasetId]);
  const map = new Map();

  for (const row of result.rows) {
    const geographyType = geographyTypeFromCode(row.region_code, row.region_level || "unknown");
    const geographyKey = await upsertOne(
      client,
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
        returning geography_key
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
      ],
      "geography_key"
    );
    map.set(`${row.dimension_key}:${row.region_code}`, geographyKey);
  }

  return map;
}

async function upsertMeasures(client, dataset) {
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
  const map = new Map();

  for (const row of result.rows) {
    const unitCode = normalizeUnit(row.unit, row.title || row.measure_key);
    const unitKey = await getUnitKey(client, unitCode);
    const aggregation = inferAggregation(row.unit, row.title || row.measure_key);
    const isAdditive = aggregation === "sum";
    const topicParts = String(row.topic_path ?? "").split(">").map((part) => part.trim()).filter(Boolean);
    const measureKey = await upsertOne(
      client,
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
        returning measure_key
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
      ],
      "measure_key"
    );

    await client.query(
      `
        insert into gold_bouwen_wonen.dim_housing_indicator (
          housing_indicator_key, measure_key, dataset_key, measure_code, indicator_name,
          indicator_description, topic, subtopic, unit_key, unit_code, unit_name,
          default_aggregation, is_additive, is_non_additive, value_type
        )
        select $1,$1,$2,$3,$4,$5,$6,$7,u.unit_key,u.unit_code,u.unit_name,$8,$9,$10,$11
        from gold.dim_unit u
        where u.unit_key = $12
        on conflict (measure_key) do update set
          indicator_name = excluded.indicator_name,
          indicator_description = excluded.indicator_description,
          topic = excluded.topic,
          subtopic = excluded.subtopic,
          unit_key = excluded.unit_key,
          unit_code = excluded.unit_code,
          unit_name = excluded.unit_name,
          default_aggregation = excluded.default_aggregation,
          is_additive = excluded.is_additive,
          is_non_additive = excluded.is_non_additive,
          value_type = excluded.value_type,
          updated_at = now()
      `,
      [
        measureKey,
        stableBigInt(["dataset", "CBS", dataset.dataset_id, dataset.source_version || dataset.cbs_updated_at || "unknown"]),
        row.measure_key,
        row.title || row.measure_key,
        row.description ?? null,
        topicParts[0] ?? null,
        topicParts.at(-1) ?? null,
        aggregation,
        isAdditive,
        !isAdditive,
        inferValueType(row.unit, row.title || row.measure_key),
        unitKey,
      ]
    );

    map.set(row.measure_key, { ...row, goldMeasureKey: measureKey, goldUnitKey: unitKey });
  }

  return map;
}

function isTotalCategory(code, name) {
  const text = `${code ?? ""} ${name ?? ""}`.toLowerCase();
  return text.includes("totaal") || text.includes("total");
}

async function upsertCategories(client, datasetKey, datasetId, primaryDimensionKeys) {
  const result = await client.query("select * from silver.cbs_dimension_values where dataset_id = $1", [datasetId]);
  const map = new Map();
  const dimensions = new Set();

  for (const row of result.rows) {
    if (primaryDimensionKeys.has(row.dimension_key)) continue;
    dimensions.add(row.dimension_key);
    const categoryKey = await upsertOne(
      client,
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
        returning category_key
      `,
      [
        stableBigInt(["category", datasetKey, row.dimension_key, row.value_key]),
        datasetKey,
        row.dimension_key,
        row.value_key,
        row.title || row.value_key,
        row.description ?? null,
        isTotalCategory(row.value_key, row.title),
      ],
      "category_key"
    );
    map.set(`${row.dimension_key}:${row.value_key}`, {
      categoryKey,
      dimensionCode: row.dimension_key,
      categoryCode: row.value_key,
      categoryName: row.title || row.value_key,
    });
  }

  for (const dimensionCode of dimensions) {
    const categoryKey = await upsertOne(
      client,
      `
        insert into gold.dim_category (
          category_key, dataset_key, dimension_code, category_code, category_name, is_unknown
        )
        values ($1,$2,$3,'UNKNOWN','Unknown category',true)
        on conflict (dataset_key, dimension_code, category_code) do update set updated_at = now()
        returning category_key
      `,
      [stableBigInt(["category", datasetKey, dimensionCode, "UNKNOWN"]), datasetKey, dimensionCode],
      "category_key"
    );
    map.set(`${dimensionCode}:UNKNOWN`, {
      categoryKey,
      dimensionCode,
      categoryCode: "UNKNOWN",
      categoryName: "Unknown category",
    });
  }

  return map;
}

async function insertHousingFacts(client, facts, writeBatchSize, { returnFactKeys = true } = {}) {
  const rows = [];
  let count = 0;
  for (const chunk of chunkRows(facts, writeBatchSize)) {
    const result = await client.query(
      `
        insert into gold_bouwen_wonen.fact_housing_observation (
          housing_dataset_key, housing_indicator_key, dataset_key, measure_key,
          date_key, geography_key, unit_key, calendar_year, period_code, period_type,
          geography_code, geography_name, geography_type, municipality_code, province_code, country_code,
          observation_value, observation_text, status_code, is_missing, is_suppressed,
          category_combination_hash, source_observation_id, silver_observation_id, bronze_record_id,
          record_hash, dataset_code, measure_code, source_dataset_id, source_row_id, bronze_ingestion_run_id
        )
        select *
        from unnest(
          $1::bigint[], $2::bigint[], $3::bigint[], $4::bigint[], $5::bigint[], $6::bigint[], $7::bigint[],
          $8::integer[], $9::text[], $10::text[], $11::text[], $12::text[], $13::text[], $14::text[],
          $15::text[], $16::text[], $17::numeric[], $18::text[], $19::text[], $20::boolean[], $21::boolean[],
          $22::text[], $23::text[], $24::text[], $25::text[], $26::text[], $27::text[], $28::text[],
          $29::text[], $30::text[], $31::uuid[]
        ) as rows(
          housing_dataset_key, housing_indicator_key, dataset_key, measure_key,
          date_key, geography_key, unit_key, calendar_year, period_code, period_type,
          geography_code, geography_name, geography_type, municipality_code, province_code, country_code,
          observation_value, observation_text, status_code, is_missing, is_suppressed,
          category_combination_hash, source_observation_id, silver_observation_id, bronze_record_id,
          record_hash, dataset_code, measure_code, source_dataset_id, source_row_id, bronze_ingestion_run_id
        )
        on conflict (
          dataset_key, measure_key, date_key, geography_key, category_combination_hash, source_observation_id
        ) do update set
          housing_dataset_key = excluded.housing_dataset_key,
          housing_indicator_key = excluded.housing_indicator_key,
          unit_key = excluded.unit_key,
          calendar_year = excluded.calendar_year,
          period_code = excluded.period_code,
          period_type = excluded.period_type,
          geography_code = excluded.geography_code,
          geography_name = excluded.geography_name,
          geography_type = excluded.geography_type,
          municipality_code = excluded.municipality_code,
          province_code = excluded.province_code,
          country_code = excluded.country_code,
          observation_value = excluded.observation_value,
          observation_text = excluded.observation_text,
          status_code = excluded.status_code,
          is_missing = excluded.is_missing,
          is_suppressed = excluded.is_suppressed,
          silver_observation_id = excluded.silver_observation_id,
          bronze_record_id = excluded.bronze_record_id,
          record_hash = excluded.record_hash,
          dataset_code = excluded.dataset_code,
          measure_code = excluded.measure_code,
          source_dataset_id = excluded.source_dataset_id,
          source_row_id = excluded.source_row_id,
          bronze_ingestion_run_id = excluded.bronze_ingestion_run_id,
          updated_at = now()
        ${returnFactKeys ? "returning housing_observation_key, record_hash" : ""}
      `,
      [
        chunk.map((row) => row.housingDatasetKey),
        chunk.map((row) => row.housingIndicatorKey),
        chunk.map((row) => row.datasetKey),
        chunk.map((row) => row.measureKey),
        chunk.map((row) => row.dateKey),
        chunk.map((row) => row.geographyKey),
        chunk.map((row) => row.unitKey),
        chunk.map((row) => row.calendarYear),
        chunk.map((row) => row.periodCode),
        chunk.map((row) => row.periodType),
        chunk.map((row) => row.geographyCode),
        chunk.map((row) => row.geographyName),
        chunk.map((row) => row.geographyType),
        chunk.map((row) => row.municipalityCode),
        chunk.map((row) => row.provinceCode),
        chunk.map((row) => row.countryCode),
        chunk.map((row) => row.observationValue),
        chunk.map((row) => row.observationText),
        chunk.map((row) => row.statusCode),
        chunk.map((row) => row.isMissing),
        chunk.map((row) => row.isSuppressed),
        chunk.map((row) => row.categoryCombinationHash),
        chunk.map((row) => row.sourceObservationId),
        chunk.map((row) => row.silverObservationId),
        chunk.map((row) => row.bronzeRecordId),
        chunk.map((row) => row.recordHash),
        chunk.map((row) => row.datasetCode),
        chunk.map((row) => row.measureCode),
        chunk.map((row) => row.sourceDatasetId),
        chunk.map((row) => row.sourceRowId),
        chunk.map((row) => row.bronzeIngestionRunId),
      ]
    );
    count += result.rowCount ?? 0;
    if (returnFactKeys) rows.push(...result.rows);
  }
  return { count, rows };
}

async function insertHousingBridgeRows(client, bridgeRows, writeBatchSize) {
  let count = 0;
  for (const chunk of chunkRows(bridgeRows, writeBatchSize)) {
    const result = await client.query(
      `
        insert into gold_bouwen_wonen.bridge_housing_observation_category (
          housing_observation_key, category_key, dimension_code, category_code, category_name
        )
        select *
        from unnest($1::bigint[], $2::bigint[], $3::text[], $4::text[], $5::text[])
          as rows(housing_observation_key, category_key, dimension_code, category_code, category_name)
        on conflict (housing_observation_key, category_key) do update set
          dimension_code = excluded.dimension_code,
          category_code = excluded.category_code,
          category_name = excluded.category_name
      `,
      [
        chunk.map((row) => row.housingObservationKey),
        chunk.map((row) => row.categoryKey),
        chunk.map((row) => row.dimensionCode),
        chunk.map((row) => row.categoryCode),
        chunk.map((row) => row.categoryName),
      ]
    );
    count += result.rowCount ?? 0;
  }
  return count;
}

async function loadDataset(client, dataset, options) {
  console.log(`Loading Bouwen en wonen mart from Silver: ${dataset.dataset_id}`);

  try {
    const datasetKey = await upsertDataset(client, dataset);
    if (options.refresh) {
      await client.query("delete from gold_bouwen_wonen.fact_housing_observation where dataset_key = $1", [datasetKey]);
      await client.query("delete from gold_bouwen_wonen.dataset_load_progress where dataset_key = $1", [datasetKey]);
    }

    let from = 0;
    if (!options.refresh && options.resume) {
      const lastRowState = await getLastSilverObservationLoadState(client, dataset.dataset_id, datasetKey);
      if (lastRowState.isComplete) {
        await upsertDatasetProgress(client, {
          datasetKey,
          datasetCode: dataset.dataset_id,
          status: "complete",
          nextRowIndex: Number(lastRowState.lastObservation.row_index) + 1,
          completed: true,
        });
        console.log(
          `  ${dataset.dataset_id}: already complete in Gold (last Silver row ${lastRowState.lastObservation.row_index} has ${lastRowState.loadedLastRowFacts}/${lastRowState.expectedLastRowFacts} facts), skipped`
        );
        return {
          sourceRows: 0,
          factRows: 0,
          bridgeRows: 0,
          skipped: true,
          expectedFactRows: null,
          loadedFactRows: null,
        };
      }

      const progress = await getDatasetProgress(client, datasetKey);
      if (progress && Number(progress.next_row_index) > 0) {
        from = Number(progress.next_row_index);
        console.log(`  ${dataset.dataset_id}: resuming from progress row_index ${from}`);
      } else if (await hasFirstGoldRowForDataset(client, datasetKey)) {
        from = await getResumeRowIndex(client, dataset.dataset_id, datasetKey);
        console.log(`  ${dataset.dataset_id}: resuming from existing Gold facts row_index ${from}`);
      }
    }

    await upsertDatasetProgress(client, {
      datasetKey,
      datasetCode: dataset.dataset_id,
      status: "loading",
      nextRowIndex: from,
    });

    const grain = await getDatasetGrain(client, dataset.dataset_id);
    const periodDimensionKey = grain.period_dimension_key || "Perioden";
    const spatialDimensionKeys = new Set(grain.spatial_dimension_keys ?? []);
    const primaryDimensionKeys = new Set([periodDimensionKey, ...spatialDimensionKeys]);
    const dateMap = await upsertDates(client, dataset.dataset_id);
    const geographyMap = await upsertGeographies(client, dataset.dataset_id);
    const measureMap = await upsertMeasures(client, dataset);
    const categoryMap = await upsertCategories(client, datasetKey, dataset.dataset_id, primaryDimensionKeys);

    const dateDetails = new Map((await client.query("select * from gold.dim_date")).rows.map((row) => [String(row.date_key), row]));
    const geographyDetails = new Map((await client.query("select * from gold.dim_geography")).rows.map((row) => [String(row.geography_key), row]));

    let sourceRows = 0;
    let factRows = 0;
    let bridgeRows = 0;
    let batchesProcessed = 0;
    let stoppedEarly = false;

    while (true) {
      const observations = (await client.query(
        `
          select *
          from silver.cbs_observations
          where dataset_id = $1 and row_index >= $2
          order by row_index asc
          limit $3
        `,
        [dataset.dataset_id, from, Math.max(1, options.batchSize)]
      )).rows;
      if (observations.length === 0) break;

      let readBatchFacts = 0;
      let readBatchRows = 0;
      for (const observationChunk of chunkRows(observations, Math.max(1, options.lookupChunkSize))) {
        const chunkStartedAt = Date.now();
        const rowIds = observationChunk.map((row) => row.row_id);
        const [dimensionResult, measureResult] = await Promise.all([
          client.query("select * from silver.cbs_observation_dimensions where dataset_id = $1 and row_id = any($2::text[])", [dataset.dataset_id, rowIds]),
          client.query("select * from silver.cbs_observation_measures where dataset_id = $1 and row_id = any($2::text[])", [dataset.dataset_id, rowIds]),
        ]);

        const dimensionsByRow = new Map();
        for (const row of dimensionResult.rows) {
          const list = dimensionsByRow.get(row.row_id) ?? [];
          list.push(row);
          dimensionsByRow.set(row.row_id, list);
        }
        const measuresByRow = new Map();
        for (const row of measureResult.rows) {
          const list = measuresByRow.get(row.row_id) ?? [];
          list.push(row);
          measuresByRow.set(row.row_id, list);
        }

        const factPayloads = [];
        const bridgePayloadsByHash = new Map();
        let hasCategoryBridgeRows = false;

        for (const observation of observationChunk) {
          const dims = dimensionsByRow.get(observation.row_id) ?? [];
          const periodValue = dims.find((dim) => dim.dimension_key === periodDimensionKey)?.value_key;
          const dateKey = periodValue ? dateMap.get(periodValue) ?? -1 : -1;
          const date = dateDetails.get(String(dateKey)) ?? {};
          const spatialDim = dims.find((dim) => spatialDimensionKeys.has(dim.dimension_key));
          const geographyKey = spatialDim ? geographyMap.get(`${spatialDim.dimension_key}:${spatialDim.value_key}`) ?? -1 : -1;
          const geography = geographyDetails.get(String(geographyKey)) ?? {};
          const categories = dims
            .filter((dim) => !primaryDimensionKeys.has(dim.dimension_key))
            .map((dim) => categoryMap.get(`${dim.dimension_key}:${dim.value_key}`) ?? categoryMap.get(`${dim.dimension_key}:UNKNOWN`))
            .filter(Boolean);
          if (categories.length > 0) hasCategoryBridgeRows = true;
          const combinationHash = categoryCombinationHash(categories.map((category) => ({
            dimensionCode: category.dimensionCode,
            categoryCode: category.categoryCode,
          })));
          bridgePayloadsByHash.set(`${observation.row_id}:${combinationHash}`, categories);

          for (const measure of measuresByRow.get(observation.row_id) ?? []) {
            const measureMeta = measureMap.get(measure.measure_key);
            if (!measureMeta) continue;
            const missing = classifyMissing(measure);
            const recordHash = stableHash([
              datasetKey,
              measureMeta.goldMeasureKey,
              dateKey,
              geographyKey,
              combinationHash,
              observation.row_id,
              numericValue(measure),
              measure.value_text,
              missing.statusCode,
            ]);

            factPayloads.push({
              housingDatasetKey: datasetKey,
              housingIndicatorKey: measureMeta.goldMeasureKey,
              datasetKey,
              measureKey: measureMeta.goldMeasureKey,
              dateKey,
              geographyKey,
              unitKey: measureMeta.goldUnitKey,
              calendarYear: date.calendar_year ?? null,
              periodCode: date.period_code ?? null,
              periodType: date.period_type ?? null,
              geographyCode: geography.geography_code ?? null,
              geographyName: geography.geography_name ?? null,
              geographyType: geography.geography_type ?? null,
              municipalityCode: geography.municipality_code ?? null,
              provinceCode: geography.province_code ?? null,
              countryCode: geography.country_code ?? null,
              observationValue: numericValue(measure),
              observationText: measure.value_text,
              statusCode: missing.statusCode,
              isMissing: missing.isMissing,
              isSuppressed: missing.isSuppressed,
              categoryCombinationHash: combinationHash,
              sourceObservationId: observation.row_id,
              silverObservationId: `${observation.dataset_id}:${observation.row_id}`,
              bronzeRecordId: `${observation.dataset_id}:${observation.row_id}`,
              recordHash,
              datasetCode: dataset.dataset_id,
              measureCode: measure.measure_key,
              sourceDatasetId: observation.dataset_id,
              sourceRowId: observation.row_id,
              bronzeIngestionRunId: observation.bronze_ingestion_run_id ?? null,
              bridgeKey: `${observation.row_id}:${combinationHash}`,
            });
          }
        }

        await client.query("begin");
        let insertedFacts;
        try {
          insertedFacts = await insertHousingFacts(client, factPayloads, options.writeBatchSize, {
            returnFactKeys: hasCategoryBridgeRows,
          });

          let insertedBridgeRows = 0;
          if (hasCategoryBridgeRows) {
            const factKeyByHash = new Map(insertedFacts.rows.map((row) => [row.record_hash, row.housing_observation_key]));
            const bridgePayloads = [];
            for (const fact of factPayloads) {
              const housingObservationKey = factKeyByHash.get(fact.recordHash);
              if (!housingObservationKey) continue;
              for (const category of bridgePayloadsByHash.get(fact.bridgeKey) ?? []) {
                bridgePayloads.push({ housingObservationKey, ...category });
              }
            }
            insertedBridgeRows = await insertHousingBridgeRows(client, bridgePayloads, options.writeBatchSize);
          }

          const nextRowIndex = Number(observationChunk.at(-1).row_index) + 1;
          await upsertDatasetProgress(client, {
            datasetKey,
            datasetCode: dataset.dataset_id,
            status: "loading",
            nextRowIndex,
            sourceRowsLoaded: observationChunk.length,
            factRowsLoaded: insertedFacts.count,
            bridgeRowsLoaded: insertedBridgeRows,
          });
          await client.query("commit");
          sourceRows += observationChunk.length;
          bridgeRows += insertedBridgeRows;
          factRows += insertedFacts.count;
          readBatchFacts += insertedFacts.count;
          readBatchRows += observationChunk.length;
          from = nextRowIndex;
          const elapsedSeconds = ((Date.now() - chunkStartedAt) / 1000).toFixed(1);
          console.log(
            `  ${dataset.dataset_id}: rows ${observationChunk[0].row_index}-${observationChunk.at(-1).row_index}: +${insertedFacts.count} facts, +${insertedBridgeRows} bridge rows (${elapsedSeconds}s)`
          );
        } catch (error) {
          await client.query("rollback").catch(() => {});
          await upsertDatasetProgress(client, {
            datasetKey,
            datasetCode: dataset.dataset_id,
            status: "failed",
            nextRowIndex: from,
            lastError: error.message,
          });
          throw error;
        }
      }

      console.log(`  ${dataset.dataset_id}: read batch complete: +${readBatchFacts} housing facts from ${readBatchRows} Silver rows`);
      batchesProcessed += 1;
      if (options.maxBatches > 0 && batchesProcessed >= options.maxBatches) {
        stoppedEarly = true;
        console.log(`  ${dataset.dataset_id}: stopped after ${batchesProcessed} batch(es) by --max-batches`);
        break;
      }
    }

    if (!stoppedEarly) {
      await upsertDatasetProgress(client, {
        datasetKey,
        datasetCode: dataset.dataset_id,
        status: "complete",
        nextRowIndex: from,
        completed: true,
      });
    }
    return { sourceRows, factRows, bridgeRows };
  } catch (error) {
    throw error;
  }
}

async function loadBouwenWonenMart(client, options) {
  await ensureRuntimeTables(client);
  const runId = randomUUID();
  await client.query(
    "insert into gold_bouwen_wonen.load_runs (run_id, status, message) values ($1, 'pending', $2)",
    [runId, "Loading Bouwen en wonen facts directly from Silver into conformed Gold dimensions."]
  );

  try {
    const datasets = await getDatasets(client, options);
    console.log(`Found ${datasets.length} Bouwen en wonen Silver dataset(s) for Gold mart.`);
    let sourceRows = 0;
    let factRows = 0;
    let bridgeRows = 0;
    let skippedDatasets = 0;

    for (const dataset of datasets) {
      const result = await loadDataset(client, dataset, options);
      if (result.skipped) skippedDatasets += 1;
      sourceRows += result.sourceRows;
      factRows += result.factRows;
      bridgeRows += result.bridgeRows;
    }

    await client.query(
      `
        update gold_bouwen_wonen.load_runs
        set status = 'complete',
          source_fact_count = $2,
          mart_fact_count = $3,
          bridge_row_count = $4,
          finished_at = now(),
          message = 'Bouwen en wonen mart loaded directly from Silver.'
        where run_id = $1
      `,
      [runId, sourceRows, factRows, bridgeRows]
    );
    return { sourceRows, factRows, bridgeRows, skippedDatasets };
  } catch (error) {
    await client.query(
      "update gold_bouwen_wonen.load_runs set status = 'failed', finished_at = now(), message = $2 where run_id = $1",
      [runId, error.message]
    ).catch(() => {});
    throw error;
  }
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const client = createPostgresClient({
    applicationName: "guara-cbs-gold-bouwen-wonen-loader",
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
    const result = await loadBouwenWonenMart(client, options);
    console.log(`Bouwen en wonen mart complete: ${result.factRows} facts from ${result.sourceRows} Silver rows, ${result.bridgeRows} bridge rows, ${result.skippedDatasets ?? 0} dataset(s) skipped`);
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
