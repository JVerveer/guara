#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv, normalizeKey } from "./lib/runtime.mjs";

const STATUS = {
  PENDING: "pending",
  COMPLETE: "complete",
  COMPLETE_WITH_WARNINGS: "complete_with_warnings",
  FAILED: "failed",
  SKIPPED: "skipped",
};

export function stableHash(parts) {
  return createHash("sha256")
    .update(parts.map((part) => String(part ?? "")).join("|"))
    .digest("hex");
}

export function stableBigInt(parts) {
  return BigInt(`0x${stableHash(parts).slice(0, 15)}`).toString();
}

export function categoryCombinationHash(categories) {
  if (!categories.length) return stableHash(["NO_CATEGORIES"]);
  return stableHash(
    categories
      .map((category) => `${category.dimensionCode}=${category.categoryCode}`)
      .sort()
  );
}

export function normalizeUnit(rawUnit, measureName = "") {
  const text = `${rawUnit ?? ""} ${measureName ?? ""}`.toLowerCase();
  const clean = String(rawUnit ?? "").trim();

  if (!clean) return "UNKNOWN";
  if (text.includes("procentpunt") || text.includes("percentage point")) return "PERCENTAGE_POINTS";
  if (text.includes("%") || text.includes("percentage") || text.includes("procent")) return "PERCENT";
  if (text.includes("mln euro") || text.includes("million euro")) return "EUR_MILLIONS";
  if (text.includes("1 000 euro") || text.includes("1000 euro") || text.includes("eur1000") || text.includes("x 1 000 euro")) return "EUR_THOUSANDS";
  if (text.includes("euro") || text.includes("eur")) return "EUR";
  if (text.includes("index") || /\b\d{4}\s*=\s*100\b/.test(text)) return "INDEX";
  if (text.includes("m²") || text.includes("m2")) return "SQUARE_METERS";
  if (text.includes("m³") || text.includes("m3")) return "CUBIC_METERS";
  if (text.includes("uren") || text.includes("hours")) return "HOURS";
  if (text.includes("x 1 000") || text.includes("1 000")) return "THOUSANDS";
  if (text.includes("personen") || text.includes("people") || text.includes("inwoners")) return "PERSONS";
  if (text.includes("huishoudens")) return "HOUSEHOLDS";
  if (/aantal|count|number|woningen|bedrijven|objecten/.test(text)) return "COUNT";
  return "UNKNOWN";
}

export function inferValueType(rawUnit, measureName = "") {
  const unit = normalizeUnit(rawUnit, measureName);
  if (unit === "PERCENT") return "percentage";
  if (["EUR", "EUR_THOUSANDS", "EUR_MILLIONS"].includes(unit)) return "currency";
  if (unit === "INDEX") return "index";
  if (["COUNT", "PERSONS", "HOUSEHOLDS"].includes(unit)) return "count";
  return "decimal";
}

export function inferAggregation(rawUnit, measureName = "") {
  const unit = normalizeUnit(rawUnit, measureName);
  if (["PERCENT", "PERCENTAGE_POINTS", "INDEX"].includes(unit)) return "average";
  if (/gemiddeld|average|mediaan|index/.test(String(measureName ?? "").toLowerCase())) return "average";
  if (["COUNT", "PERSONS", "HOUSEHOLDS", "EUR", "EUR_THOUSANDS", "EUR_MILLIONS", "THOUSANDS"].includes(unit)) return "sum";
  return "none";
}

export function geographyTypeFromCode(code, fallback = "unknown") {
  const normalized = String(code ?? "").trim().toUpperCase();
  if (["NL", "NL00", "NL01"].includes(normalized)) return "country";
  if (normalized.startsWith("PV")) return "province";
  if (normalized.startsWith("GM")) return "municipality";
  if (normalized.startsWith("CR") || normalized.startsWith("LD") || normalized.startsWith("COROP")) return "region";
  return fallback === "other" || fallback === "neighborhood" ? "region" : fallback || "unknown";
}

function parseArgs(argv) {
  const options = {
    dataset: "",
    domain: "",
    rootTheme: "",
    limit: 25,
    batchSize: 50000,
    writeBatchSize: 50000,
    force: false,
    failedOnly: false,
    skipUnchanged: true,
    ensureSchema: false,
    validateOnly: false,
    writeTimeoutMs: 900000,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dataset") options.dataset = argv[++index] ?? "";
    else if (arg === "--domain") options.domain = argv[++index] ?? "";
    else if (arg === "--root-theme") options.rootTheme = argv[++index] ?? "";
    else if (arg === "--limit") options.limit = Number(argv[++index] ?? options.limit);
    else if (arg === "--batch-size") options.batchSize = Number(argv[++index] ?? options.batchSize);
    else if (arg === "--write-batch-size") options.writeBatchSize = Number(argv[++index] ?? options.writeBatchSize);
    else if (arg === "--write-timeout-ms") options.writeTimeoutMs = Number(argv[++index] ?? options.writeTimeoutMs);
    else if (arg === "--force") options.force = true;
    else if (arg === "--failed-only") options.failedOnly = true;
    else if (arg === "--no-skip-unchanged") options.skipUnchanged = false;
    else if (arg === "--ensure-schema") options.ensureSchema = true;
    else if (arg === "--validate-only") options.validateOnly = true;
    else if (arg === "--help") {
      console.log(`Usage:
  npm run load:cbs:gold -- --domain bouwen-en-wonen --limit 25
  npm run load:cbs:gold -- --root-theme "Bouwen en wonen" --limit 25
  npm run load:cbs:gold -- --dataset 85039NED
  npm run load:cbs:gold -- --ensure-schema

Options:
  --domain bouwen-en-wonen        Load datasets mapped to a Guara/CBS domain.
  --root-theme "Bouwen en wonen"  Load datasets mapped to a CBS root theme.
  --dataset 85039NED              Load one dataset.
  --limit 25                      Maximum datasets to load.
  --batch-size 50000              Silver observations read per batch.
  --write-batch-size 50000        Gold facts/bridge rows written per insert chunk.
  --force                         Delete existing Gold facts for the selected dataset version first.
  --failed-only                   Only retry failed Gold datasets.
  --no-skip-unchanged             Reload even if the same dataset version completed.
  --ensure-schema                 Execute supabase/gold_schema.sql before loading.
  --validate-only                 Run validation for selected datasets without loading facts.
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
    [item.domain_id, item.canonical_name, item.cbs_root_theme_title, ...(item.aliases ?? [])]
      .some((candidate) => normalizeKey(candidate) === normalized)
  );
  if (!domain) throw new Error(`Unknown CBS domain "${options.domain}".`);
  return domain.cbs_root_theme_title;
}

async function ensureSchema(client) {
  const sql = readFileSync(resolve(process.cwd(), "supabase/gold_schema.sql"), "utf8");
  await client.query(sql);
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

  const failedOnlyWhere = options.failedOnly
    ? "and exists (select 1 from gold.cbs_load_runs r where r.dataset_code = d.dataset_id and r.status = 'failed')"
    : "";

  const result = await client.query(
    `
      select distinct d.*
      from silver.cbs_datasets d
      join silver.cbs_dataset_load_status s on s.dataset_id = d.dataset_id
      ${themeJoin}
      where s.observations_loaded > 0
        and s.status in ('complete', 'complete_with_warnings', 'partial')
        ${themeWhere}
        ${failedOnlyWhere}
      order by d.dataset_id
      limit $1
    `,
    params
  );
  return result.rows;
}

async function upsertOne(client, sql, params, keyColumn) {
  const result = await client.query(sql, params);
  return result.rows[0][keyColumn];
}

async function getUnknownKeys(client) {
  const [date, geography, source, unit] = await Promise.all([
    client.query("select date_key from gold.dim_date where period_code = 'UNKNOWN' and period_type = 'unknown'"),
    client.query("select geography_key from gold.dim_geography where geography_code = 'UNKNOWN' and geography_type = 'unknown'"),
    client.query("select source_key from gold.dim_source where source_code = 'UNKNOWN'"),
    client.query("select unit_key from gold.dim_unit where unit_code = 'UNKNOWN'"),
  ]);

  return {
    dateKey: date.rows[0].date_key,
    geographyKey: geography.rows[0].geography_key,
    sourceKey: source.rows[0].source_key,
    unitKey: unit.rows[0].unit_key,
  };
}

async function getSourceKey(client) {
  return upsertOne(
    client,
    `
      insert into gold.dim_source (source_key, source_code, source_name, source_type, source_url)
      values ($1, 'CBS', 'Centraal Bureau voor de Statistiek', 'government', 'https://www.cbs.nl')
      on conflict (source_code) do update set updated_at = now()
      returning source_key
    `,
    [stableBigInt(["source", "CBS"])],
    "source_key"
  );
}

async function upsertDataset(client, dataset) {
  return upsertOne(
    client,
    `
      insert into gold.dim_dataset (
        dataset_key, dataset_code, dataset_title, dataset_description, source_organization, source_system,
        source_url, dataset_version, publication_date, last_updated_at_source, loaded_at, is_active
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
      dataset.cbs_updated_at ? String(dataset.cbs_updated_at).slice(0, 10) : null,
      dataset.cbs_updated_at ?? null,
    ],
    "dataset_key"
  );
}

async function getUnitKey(client, unitCode) {
  const result = await client.query("select unit_key from gold.dim_unit where unit_code = $1", [unitCode]);
  if (result.rows[0]) return result.rows[0].unit_key;
  return getUnknownKeys(client).then((keys) => keys.unitKey);
}

async function getMeasures(client, dataset) {
  const { rows } = await client.query(
    `
      select m.*, i.topic_path, i.is_additive, i.is_percentage, i.is_count, i.is_index
      from silver.cbs_measures m
      left join silver.cbs_indicator_candidates i
        on i.dataset_id = m.dataset_id and i.measure_key = m.measure_key
      where m.dataset_id = $1
      order by m.measure_key
    `,
    [dataset.dataset_id]
  );

  const map = new Map();
  let unknownUnits = 0;

  for (const row of rows) {
    const unitCode = normalizeUnit(row.unit, row.title || row.measure_key);
    const unitKey = await getUnitKey(client, unitCode);
    if (unitCode === "UNKNOWN") unknownUnits += 1;
    const aggregation = inferAggregation(row.unit, row.title || row.measure_key);
    const isAdditive = aggregation === "sum";
    const topicParts = String(row.topic_path ?? "").split(">").map((part) => part.trim()).filter(Boolean);
    const measureKey = await upsertOne(
      client,
      `
        insert into gold.dim_measure (
          measure_key, measure_code, measure_name, measure_description, topic, subtopic, unit_key,
          default_aggregation, is_additive, is_semi_additive, is_non_additive,
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
    map.set(row.measure_key, { ...row, goldMeasureKey: measureKey, goldUnitKey: unitKey });
  }

  return { measures: map, unknownUnits };
}

async function getDates(client, datasetId, unknownDateKey) {
  const { rows } = await client.query(
    "select * from silver.cbs_period_values where dataset_id = $1 order by period_key",
    [datasetId]
  );
  const map = new Map();

  for (const row of rows) {
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

  return { dateMap: map, unknownDateKey };
}

async function getGeographies(client, datasetId, unknownGeographyKey) {
  const { rows } = await client.query(
    "select * from silver.cbs_region_values where dataset_id = $1 order by dimension_key, region_code",
    [datasetId]
  );
  const map = new Map();

  for (const row of rows) {
    const geographyType = geographyTypeFromCode(row.region_code, row.region_level || "unknown");
    const geographyKey = await upsertOne(
      client,
      `
      insert into gold.dim_geography (
          geography_key, geography_code, geography_name, geography_type, municipality_code, province_code,
          country_code, valid_from, valid_to, is_current, source_system
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

  return { geographyMap: map, unknownGeographyKey };
}

function isTotalCategory(code, name) {
  const text = `${code ?? ""} ${name ?? ""}`.toLowerCase();
  return ["totaal", "total"].some((term) => text.includes(term));
}

async function getCategories(client, datasetKey, datasetId, primaryDimensionKeys) {
  const { rows } = await client.query(
    "select * from silver.cbs_dimension_values where dataset_id = $1 order by dimension_key, value_key",
    [datasetId]
  );
  const map = new Map();
  const dimensions = new Set();

  for (const row of rows) {
    if (primaryDimensionKeys.has(row.dimension_key)) continue;
    dimensions.add(row.dimension_key);
    const categoryKey = await upsertOne(
      client,
      `
        insert into gold.dim_category (
          category_key, dataset_key, dimension_code, category_code, category_name, category_description,
          category_level, sort_order, is_total, is_unknown
        )
        values ($1,$2,$3,$4,$5,$6,null,null,$7,false)
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
    map.set(`${row.dimension_key}:${row.value_key}`, categoryKey);
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
    map.set(`${dimensionCode}:UNKNOWN`, categoryKey);
  }

  return map;
}

async function getDatasetGrain(client, datasetId) {
  const result = await client.query(
    "select period_dimension_key, spatial_dimension_keys from silver.cbs_dataset_grain where dataset_id = $1",
    [datasetId]
  );
  return result.rows[0] ?? { period_dimension_key: "Perioden", spatial_dimension_keys: [] };
}

export function numericValue(measure) {
  if (measure.value_numeric !== null && measure.value_numeric !== undefined) return measure.value_numeric;
  return null;
}

export function classifyMissing(measure) {
  const text = String(measure.value_text ?? "").trim().toLowerCase();
  const isMissing = measure.value_numeric === null || measure.value_numeric === undefined || text === "" || text === ".";
  const isSuppressed = ["x", "geheim", "suppressed"].includes(text);
  return {
    isMissing: isMissing || isSuppressed,
    isSuppressed,
    statusCode: isSuppressed ? "suppressed" : isMissing ? "missing" : "reported",
  };
}

async function insertFacts(client, facts, writeBatchSize) {
  const rows = [];
  for (const chunk of chunkRows(facts, writeBatchSize)) {
    const result = await client.query(
      `
        insert into gold.fact_observation (
          dataset_key, measure_key, date_key, geography_key, source_key,
          observation_value, observation_text, unit_key, status_code,
          is_missing, is_suppressed, is_preliminary,
          source_observation_id, silver_observation_id, bronze_record_id, ingestion_run_id,
          category_combination_hash, record_hash, updated_at
        )
        select *, now()
        from unnest(
          $1::bigint[], $2::bigint[], $3::bigint[], $4::bigint[], $5::bigint[],
          $6::numeric[], $7::text[], $8::bigint[], $9::text[],
          $10::boolean[], $11::boolean[], $12::boolean[],
          $13::text[], $14::text[], $15::text[], $16::uuid[],
          $17::text[], $18::text[]
        ) as rows(
          dataset_key, measure_key, date_key, geography_key, source_key,
          observation_value, observation_text, unit_key, status_code,
          is_missing, is_suppressed, is_preliminary,
          source_observation_id, silver_observation_id, bronze_record_id, ingestion_run_id,
          category_combination_hash, record_hash
        )
        on conflict (
          dataset_key, measure_key, date_key, geography_key, category_combination_hash, source_observation_id
        ) do update set
          observation_value = excluded.observation_value,
          observation_text = excluded.observation_text,
          unit_key = excluded.unit_key,
          status_code = excluded.status_code,
          is_missing = excluded.is_missing,
          is_suppressed = excluded.is_suppressed,
          is_preliminary = excluded.is_preliminary,
          silver_observation_id = excluded.silver_observation_id,
          bronze_record_id = excluded.bronze_record_id,
          ingestion_run_id = excluded.ingestion_run_id,
          record_hash = excluded.record_hash,
          updated_at = now()
        returning observation_key, record_hash
      `,
      [
        chunk.map((row) => row.datasetKey),
        chunk.map((row) => row.measureKey),
        chunk.map((row) => row.dateKey),
        chunk.map((row) => row.geographyKey),
        chunk.map((row) => row.sourceKey),
        chunk.map((row) => row.observationValue),
        chunk.map((row) => row.observationText),
        chunk.map((row) => row.unitKey),
        chunk.map((row) => row.statusCode),
        chunk.map((row) => row.isMissing),
        chunk.map((row) => row.isSuppressed),
        chunk.map((row) => row.isPreliminary),
        chunk.map((row) => row.sourceObservationId),
        chunk.map((row) => row.silverObservationId),
        chunk.map((row) => row.bronzeRecordId),
        chunk.map((row) => row.ingestionRunId),
        chunk.map((row) => row.categoryCombinationHash),
        chunk.map((row) => row.recordHash),
      ]
    );
    rows.push(...result.rows);
  }
  return rows;
}

async function insertBridgeRows(client, bridgeRows, writeBatchSize) {
  let count = 0;
  for (const chunk of chunkRows(bridgeRows, writeBatchSize)) {
    const result = await client.query(
      `
        insert into gold.bridge_observation_category (
          observation_key, category_key, dimension_code
        )
        select *
        from unnest($1::bigint[], $2::bigint[], $3::text[])
          as rows(observation_key, category_key, dimension_code)
        on conflict (observation_key, category_key) do nothing
      `,
      [
        chunk.map((row) => row.observationKey),
        chunk.map((row) => row.categoryKey),
        chunk.map((row) => row.dimensionCode),
      ]
    );
    count += result.rowCount ?? 0;
  }
  return count;
}

function chunkRows(rows, size) {
  const chunks = [];
  const chunkSize = Math.max(1, size);
  for (let index = 0; index < rows.length; index += chunkSize) chunks.push(rows.slice(index, index + chunkSize));
  return chunks;
}

async function loadSemanticMetadata(client, dataset, measures) {
  for (const [measureCode, measure] of measures.entries()) {
    const metricName = `cbs_${dataset.dataset_id.toLowerCase()}_${measureCode.toLowerCase()}`.replace(/[^a-z0-9_]+/g, "_");
    const metricId = await upsertOne(
      client,
      `
        insert into semantic.metric (
          metric_name, metric_label, description, measure_key, aggregation, unit_key
        )
        values ($1,$2,$3,$4,$5,$6)
        on conflict (metric_name) do update set
          metric_label = excluded.metric_label,
          description = excluded.description,
          measure_key = excluded.measure_key,
          aggregation = excluded.aggregation,
          unit_key = excluded.unit_key,
          updated_at = now()
        returning metric_id
      `,
      [
        metricName,
        measure.title || measure.measure_key,
        measure.description ?? null,
        measure.goldMeasureKey,
        inferAggregation(measure.unit, measure.title || measure.measure_key),
        measure.goldUnitKey,
      ],
      "metric_id"
    );

    await client.query(
      `
        insert into semantic.metric_dimension (metric_id, dimension_name, is_required, is_default)
        values ($1,'date',true,true), ($1,'geography',false,true), ($1,'category',false,false)
        on conflict (metric_id, dimension_name) do update set
          is_required = excluded.is_required,
          is_default = excluded.is_default
      `,
      [metricId]
    );

    for (const synonym of [measure.title, measure.measure_key].filter(Boolean)) {
      await client.query(
        `
          insert into semantic.synonym (object_type, object_id, synonym, language_code)
          values ('measure', $1, $2, 'nl')
          on conflict (object_type, object_id, synonym, language_code) do nothing
        `,
        [String(measure.goldMeasureKey), synonym]
      );
    }

    if (measure.description) {
      await client.query(
        `
          insert into semantic.definition_version (
            object_type, object_id, definition_text, valid_from, comparability_status
          )
          values ('measure', $1, $2, null, 'source-defined')
        `,
        [String(measure.goldMeasureKey), measure.description]
      );
    }
  }
}

async function validateDataset(client, runId, datasetKey, datasetCode, sourceObservationCount) {
  const checks = [];

  const duplicateFacts = await client.query(
    `
      select count(*)::bigint as count
      from (
        select dataset_key, measure_key, date_key, geography_key, category_combination_hash, source_observation_id
        from gold.fact_observation
        where dataset_key = $1
        group by 1,2,3,4,5,6
        having count(*) > 1
      ) duplicates
    `,
    [datasetKey]
  );
  checks.push({
    checkName: "fact_grain_uniqueness",
    status: Number(duplicateFacts.rows[0].count) === 0 ? "passed" : "failed",
    expected: "0",
    actual: duplicateFacts.rows[0].count,
    message: "No duplicate fact rows at declared grain.",
  });

  const brokenBridge = await client.query(
    `
      select count(*)::bigint as count
      from gold.bridge_observation_category bridge
      left join gold.fact_observation fact on fact.observation_key = bridge.observation_key
      left join gold.dim_category category on category.category_key = bridge.category_key
      where fact.observation_key is null or category.category_key is null
    `
  );
  checks.push({
    checkName: "bridge_referential_integrity",
    status: Number(brokenBridge.rows[0].count) === 0 ? "passed" : "failed",
    expected: "0",
    actual: brokenBridge.rows[0].count,
    message: "Bridge rows resolve to facts and categories.",
  });

  const factCount = await client.query(
    "select count(*)::bigint as count from gold.fact_observation where dataset_key = $1",
    [datasetKey]
  );
  checks.push({
    checkName: "fact_coverage",
    status: Number(factCount.rows[0].count) >= sourceObservationCount ? "passed" : "warning",
    expected: String(sourceObservationCount),
    actual: factCount.rows[0].count,
    message: "Fact count should be at least source observation count when measures are present.",
  });

  for (const check of checks) {
    await client.query(
      `
        insert into gold.validation_result (
          run_id, dataset_code, check_name, status, expected_value, actual_value, message
        )
        values ($1,$2,$3,$4,$5,$6,$7)
      `,
      [runId, datasetCode, check.checkName, check.status, check.expected, String(check.actual), check.message]
    );
  }

  return checks;
}

async function shouldSkip(client, dataset) {
  const result = await client.query(
    `
      select 1
      from gold.cbs_load_runs
      where dataset_code = $1
        and dataset_version = $2
        and status in ('complete', 'complete_with_warnings')
      limit 1
    `,
    [dataset.dataset_id, dataset.source_version || dataset.cbs_updated_at || "unknown"]
  );
  return result.rows.length > 0;
}

async function deleteGoldDatasetVersion(client, datasetKey) {
  await client.query("delete from gold.fact_observation where dataset_key = $1", [datasetKey]);
}

async function loadDataset(client, dataset, options) {
  const datasetVersion = dataset.source_version || dataset.cbs_updated_at || "unknown";
  if (options.skipUnchanged && !options.force && await shouldSkip(client, dataset)) {
    console.log(`Skipped ${dataset.dataset_id}: Gold already complete for ${datasetVersion}.`);
    return { status: STATUS.SKIPPED };
  }

  const runId = randomUUID();
  await client.query(
    `
      insert into gold.cbs_load_runs (run_id, dataset_code, dataset_version, status)
      values ($1,$2,$3,'pending')
    `,
    [runId, dataset.dataset_id, datasetVersion]
  );

  console.log(`Loading Gold dataset ${dataset.dataset_id}`);

  try {
    await client.query("begin");
    const unknown = await getUnknownKeys(client);
    const sourceKey = await getSourceKey(client);
    const datasetKey = await upsertDataset(client, dataset);
    if (options.force) await deleteGoldDatasetVersion(client, datasetKey);

    const grain = await getDatasetGrain(client, dataset.dataset_id);
    const periodDimensionKey = grain.period_dimension_key || "Perioden";
    const spatialDimensionKeys = new Set(grain.spatial_dimension_keys ?? []);
    const primaryDimensionKeys = new Set([periodDimensionKey, ...spatialDimensionKeys]);

    const { measures, unknownUnits } = await getMeasures(client, dataset);
    const { dateMap } = await getDates(client, dataset.dataset_id, unknown.dateKey);
    const { geographyMap } = await getGeographies(client, dataset.dataset_id, unknown.geographyKey);
    const categoryMap = await getCategories(client, datasetKey, dataset.dataset_id, primaryDimensionKeys);
    await loadSemanticMetadata(client, dataset, measures);

    if (options.validateOnly) {
      await client.query("commit");
      const checks = await validateDataset(client, runId, datasetKey, dataset.dataset_id, 0);
      return { status: checks.some((check) => check.status === "failed") ? STATUS.FAILED : STATUS.COMPLETE };
    }

    let from = 0;
    let sourceObservationCount = 0;
    let factCount = 0;
    let bridgeCount = 0;
    let missingCount = 0;
    let suppressedCount = 0;
    let preliminaryCount = 0;
    let unresolvedGeographyCount = 0;
    let unmappedMeasureCount = 0;

    while (true) {
      const observationsResult = await client.query(
        `
          select *
          from silver.cbs_observations
          where dataset_id = $1
            and row_index >= $2
          order by row_index asc
          limit $3
        `,
        [dataset.dataset_id, from, Math.max(1, options.batchSize)]
      );
      const observations = observationsResult.rows;
      if (observations.length === 0) break;

      sourceObservationCount += observations.length;
      const rowIds = observations.map((row) => row.row_id);
      const [dimensionResult, measureResult] = await Promise.all([
        client.query(
          "select * from silver.cbs_observation_dimensions where dataset_id = $1 and row_id = any($2::text[])",
          [dataset.dataset_id, rowIds]
        ),
        client.query(
          "select * from silver.cbs_observation_measures where dataset_id = $1 and row_id = any($2::text[])",
          [dataset.dataset_id, rowIds]
        ),
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

      for (const observation of observations) {
        const dims = dimensionsByRow.get(observation.row_id) ?? [];
        const periodValue = dims.find((dim) => dim.dimension_key === periodDimensionKey)?.value_key;
        const dateKey = periodValue ? dateMap.get(periodValue) ?? unknown.dateKey : unknown.dateKey;
        const spatialDim = dims.find((dim) => spatialDimensionKeys.has(dim.dimension_key));
        const geographyKey = spatialDim
          ? geographyMap.get(`${spatialDim.dimension_key}:${spatialDim.value_key}`) ?? unknown.geographyKey
          : unknown.geographyKey;
        if (geographyKey === unknown.geographyKey) unresolvedGeographyCount += 1;

        const categories = dims
          .filter((dim) => !primaryDimensionKeys.has(dim.dimension_key))
          .map((dim) => ({
            dimensionCode: dim.dimension_key,
            categoryCode: dim.value_key,
            categoryKey: categoryMap.get(`${dim.dimension_key}:${dim.value_key}`) ?? categoryMap.get(`${dim.dimension_key}:UNKNOWN`),
          }))
          .filter((category) => category.categoryKey);
        const combinationHash = categoryCombinationHash(categories);
        bridgePayloadsByHash.set(`${observation.row_id}:${combinationHash}`, categories);

        for (const measure of measuresByRow.get(observation.row_id) ?? []) {
          const measureMeta = measures.get(measure.measure_key);
          if (!measureMeta) {
            unmappedMeasureCount += 1;
            continue;
          }
          const missing = classifyMissing(measure);
          if (missing.isMissing) missingCount += 1;
          if (missing.isSuppressed) suppressedCount += 1;
          const isPreliminary = false;
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
            datasetKey,
            measureKey: measureMeta.goldMeasureKey,
            dateKey,
            geographyKey,
            sourceKey,
            observationValue: numericValue(measure),
            observationText: measure.value_text,
            unitKey: measureMeta.goldUnitKey,
            statusCode: missing.statusCode,
            isMissing: missing.isMissing,
            isSuppressed: missing.isSuppressed,
            isPreliminary,
            sourceObservationId: observation.row_id,
            silverObservationId: `${observation.dataset_id}:${observation.row_id}`,
            bronzeRecordId: `${observation.dataset_id}:${observation.row_id}`,
            ingestionRunId: observation.bronze_ingestion_run_id ?? null,
            categoryCombinationHash: combinationHash,
            recordHash,
            bridgeKey: `${observation.row_id}:${combinationHash}`,
          });
          if (isPreliminary) preliminaryCount += 1;
        }
      }

      const insertedFacts = await insertFacts(client, factPayloads, options.writeBatchSize);
      const factKeyByHash = new Map(insertedFacts.map((row) => [row.record_hash, row.observation_key]));
      const bridgeRows = [];
      for (const fact of factPayloads) {
        const observationKey = factKeyByHash.get(fact.recordHash);
        if (!observationKey) continue;
        for (const category of bridgePayloadsByHash.get(fact.bridgeKey) ?? []) {
          bridgeRows.push({
            observationKey,
            categoryKey: category.categoryKey,
            dimensionCode: category.dimensionCode,
          });
        }
      }
      bridgeCount += await insertBridgeRows(client, bridgeRows, options.writeBatchSize);
      factCount += insertedFacts.length;
      from = Number(observations.at(-1).row_index) + 1;
      console.log(`  Gold rows ${dataset.dataset_id}: +${insertedFacts.length} facts, +${bridgeRows.length} bridge candidates`);
    }

    const validationChecks = await validateDataset(client, runId, datasetKey, dataset.dataset_id, sourceObservationCount);
    const validationStatus = validationChecks.some((check) => check.status === "failed") ? "failed" : "passed";
    const finalStatus = validationStatus === "failed" ? STATUS.FAILED : STATUS.COMPLETE;
    const validationErrors = validationChecks.filter((check) => check.status === "failed").map((check) => check.checkName);

    await client.query(
      `
        update gold.cbs_load_runs
        set status = $2,
          source_observation_count = $3,
          gold_fact_count = $4,
          category_bridge_count = $5,
          missing_value_count = $6,
          suppressed_value_count = $7,
          preliminary_value_count = $8,
          unresolved_geography_count = $9,
          unknown_unit_count = $10,
          unmapped_measure_count = $11,
          validation_status = $12,
          validation_errors = $13::text[],
          finished_at = now()
        where run_id = $1
      `,
      [
        runId,
        finalStatus,
        sourceObservationCount,
        factCount,
        bridgeCount,
        missingCount,
        suppressedCount,
        preliminaryCount,
        unresolvedGeographyCount,
        unknownUnits,
        unmappedMeasureCount,
        validationStatus,
        validationErrors,
      ]
    );

    await client.query("commit");
    console.log(
      `Gold ${finalStatus} ${dataset.dataset_id}: ${factCount} facts, ${bridgeCount} bridge rows, ${missingCount} missing, ${suppressedCount} suppressed, ${unresolvedGeographyCount} unresolved geographies, validation ${validationStatus}`
    );
    return { status: finalStatus, factCount, bridgeCount };
  } catch (error) {
    await client.query("rollback").catch(() => {});
    await client.query(
      `
        update gold.cbs_load_runs
        set status = 'failed',
          validation_status = 'failed',
          validation_errors = array[$2],
          finished_at = now()
        where run_id = $1
      `,
      [runId, error.message]
    ).catch(() => {});
    console.error(`Failed Gold load for ${dataset.dataset_id}: ${error.message}`);
    return { status: STATUS.FAILED, error: error.message };
  }
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const client = createPostgresClient({
    applicationName: "guara-cbs-gold-loader",
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
    const datasets = await getDatasets(client, options);
    console.log(`Found ${datasets.length} Silver CBS dataset(s) eligible for Gold.`);

    const summary = {};
    for (const dataset of datasets) {
      const result = await loadDataset(client, dataset, options);
      summary[result.status] = (summary[result.status] ?? 0) + 1;
    }

    console.log(`Gold load summary: ${JSON.stringify(summary)}`);
    if (summary[STATUS.FAILED]) process.exitCode = 1;
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
