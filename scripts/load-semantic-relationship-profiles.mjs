#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

const SOURCE_CONFIG = {
  "gold_bouwen_wonen": {
    fact: "gold_bouwen_wonen.fact_housing_observation",
    bridge: "gold_bouwen_wonen.bridge_housing_observation_category",
    observationKey: "housing_observation_key",
  },
  "gold_inkomen_bestedingen": {
    fact: "gold_inkomen_bestedingen.fact_income_observation",
    bridge: "gold_inkomen_bestedingen.bridge_income_observation_category",
    observationKey: "income_observation_key",
  },
};

function parseArgs(argv) {
  const options = {
    ensureSchema: false,
    crossDomainOnly: true,
    includeSameDomain: false,
    domain: "",
    year: null,
    geographyType: "",
    minObservations: 20,
    minAbsPearson: 0,
    strongThreshold: 0.7,
    limitPairs: 0,
    statementTimeoutMs: 900000,
    top: 20,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--ensure-schema") options.ensureSchema = true;
    else if (arg === "--include-same-domain") {
      options.includeSameDomain = true;
      options.crossDomainOnly = false;
    } else if (arg === "--cross-domain-only") {
      options.crossDomainOnly = true;
      options.includeSameDomain = false;
    } else if (arg === "--domain") options.domain = argv[++index] ?? "";
    else if (arg === "--year") options.year = Number(argv[++index]);
    else if (arg === "--geography-type") options.geographyType = argv[++index] ?? "";
    else if (arg === "--min-observations") options.minObservations = Number(argv[++index] ?? options.minObservations);
    else if (arg === "--min-abs-pearson") options.minAbsPearson = Number(argv[++index] ?? options.minAbsPearson);
    else if (arg === "--strong-threshold") options.strongThreshold = Number(argv[++index] ?? options.strongThreshold);
    else if (arg === "--limit-pairs") options.limitPairs = Number(argv[++index] ?? 0);
    else if (arg === "--statement-timeout-ms") options.statementTimeoutMs = Number(argv[++index] ?? options.statementTimeoutMs);
    else if (arg === "--top") options.top = Number(argv[++index] ?? options.top);
    else if (arg === "--help") {
      console.log(`Usage:
  npm run load:semantic:relationships -- --ensure-schema
  npm run load:semantic:relationships -- --year 2024 --geography-type municipality --min-abs-pearson 0.7
  npm run load:semantic:relationships -- --include-same-domain --min-observations 50

Options:
  --ensure-schema                 Apply supabase/semantic_relationship_schema.sql first.
  --cross-domain-only             Only compare metrics across different domains. Default.
  --include-same-domain           Also compare metrics inside the same domain.
  --domain <domain_id>            Limit contracts to one domain.
  --year <YYYY>                   Limit profiling to one year.
  --geography-type <type>         Limit to municipality, province, region or country.
  --min-observations <n>          Minimum complete paired observations. Default 20.
  --min-abs-pearson <n>           Store only abs(Pearson) >= threshold. Default 0.
  --strong-threshold <n>          Strong relationship threshold for summary. Default 0.7.
  --limit-pairs <n>               Stop after N candidate pairs, useful for testing.
  --statement-timeout-ms <n>      Postgres statement timeout. Default 900000.
  --top <n>                       Print top N strongest profiles. Default 20.
`);
      process.exit(0);
    }
  }
  return options;
}

function sourceForDomain(domainId) {
  if (domainId === "inkomen-en-bestedingen") return "gold_inkomen_bestedingen";
  return "gold_bouwen_wonen";
}

function normalizeGeographyTypeFromGrain(grain) {
  const geography = String(grain ?? "").split("_")[0];
  if (geography === "national") return "country";
  return geography || "";
}

function grainFor(geographyType) {
  return `${geographyType}_year`;
}

function supportedGeographyTypes(contract) {
  const grains = Array.isArray(contract.valid_grains) ? contract.valid_grains : [];
  return Array.from(new Set(grains.map(normalizeGeographyTypeFromGrain).filter(Boolean)));
}

function firstDatasetCode(contract) {
  return Array.isArray(contract.dataset_codes) && contract.dataset_codes.length ? String(contract.dataset_codes[0]) : "";
}

function canonicalPair(left, right) {
  const leftKey = `${left.metric_code}:${left.measure_key}`;
  const rightKey = `${right.metric_code}:${right.measure_key}`;
  return leftKey <= rightKey ? [left, right] : [right, left];
}

function relationshipDirection(value) {
  if (value == null || !Number.isFinite(value)) return "unknown";
  if (Math.abs(value) < 0.05) return "none";
  return value > 0 ? "positive" : "negative";
}

function relationshipStrength(value) {
  if (value == null || !Number.isFinite(value)) return "insufficient_data";
  const abs = Math.abs(value);
  if (abs >= 0.7) return "strong";
  if (abs >= 0.4) return "moderate";
  if (abs >= 0.2) return "weak";
  return "very_weak";
}

function qualityStatus(observationCount, pearson) {
  if (observationCount < 20 || pearson == null || !Number.isFinite(pearson)) return "insufficient_observations";
  if (Math.abs(pearson) >= 0.7) return "strong_candidate";
  if (Math.abs(pearson) >= 0.4) return "moderate_candidate";
  return "profiled";
}

async function ensureSchema(client) {
  await client.query(readFileSync(resolve(process.cwd(), "supabase/semantic_relationship_schema.sql"), "utf8"));
}

async function fetchContracts(client, options) {
  const { rows } = await client.query(
    `
      select
        metric_code,
        label,
        domain_id,
        measure_key::text as measure_key,
        dataset_codes,
        unit_code,
        valid_grains,
        category_filters,
        metadata_origin,
        contract_status,
        execution_status,
        semantic_quality_status
      from semantic.metric_contract
      where is_active
        and execution_status = 'enabled'
        and coalesce(contract_status, '') in ('reviewed', 'curated')
        and ($1::text is null or domain_id = $1)
      order by domain_id, selection_priority, metric_code
    `,
    [options.domain || null]
  );
  return rows
    .map((row) => ({
      ...row,
      measure_key: String(row.measure_key),
      dataset_code: firstDatasetCode(row),
      source: sourceForDomain(row.domain_id),
      geography_types: supportedGeographyTypes(row),
      category_filters: row.category_filters ?? {},
    }))
    .filter((row) => row.dataset_code && row.measure_key && SOURCE_CONFIG[row.source] && row.geography_types.length);
}

function valueCteSql(alias, component, geographyType, year, paramOffset) {
  const source = SOURCE_CONFIG[component.source];
  const filtersParam = `$${paramOffset}`;
  const measureParam = `$${paramOffset + 1}`;
  const datasetParam = `$${paramOffset + 2}`;
  const geographyParam = `$${paramOffset + 3}`;
  const yearParam = `$${paramOffset + 4}`;
  return `
    ${alias} as (
      select
        f.geography_code,
        f.calendar_year,
        max((f.observation_value * coalesce(u.scale_factor, 1))::double precision) as value
      from ${source.fact} f
      join gold.dim_unit u on u.unit_key = f.unit_key
      where f.measure_key = ${measureParam}::bigint
        and f.dataset_code = ${datasetParam}
        and f.geography_type = ${geographyParam}
        and (${yearParam}::integer is null or f.calendar_year = ${yearParam}::integer)
        and f.observation_value is not null
        and f.is_missing = false
        and f.is_suppressed = false
        and (
          ${filtersParam}::jsonb = '{}'::jsonb
          or not exists (
            select 1
            from jsonb_each_text(${filtersParam}::jsonb) required_filter(dimension_code, category_value)
            where not exists (
              select 1
              from ${source.bridge} c
              where c.${source.observationKey} = f.${source.observationKey}
                and lower(c.dimension_code) = lower(required_filter.dimension_code)
                and (c.category_name = required_filter.category_value or c.category_code = required_filter.category_value)
            )
          )
        )
      group by f.geography_code, f.calendar_year
    )
  `;
}

async function profilePair(client, left, right, geographyType, options) {
  const [a, b] = canonicalPair(left, right);
  const sql = `
    with
    ${valueCteSql("a", a, geographyType, options.year, 1)},
    ${valueCteSql("b", b, geographyType, options.year, 6)},
    joined as (
      select
        a.geography_code,
        a.calendar_year,
        a.value as value_a,
        b.value as value_b
      from a
      join b
        on b.geography_code = a.geography_code
       and b.calendar_year = a.calendar_year
      where a.value is not null
        and b.value is not null
    )
    select
      calendar_year,
      count(*)::integer as observation_count,
      count(distinct geography_code)::integer as geography_count,
      corr(value_a, value_b)::numeric as pearson_correlation
    from joined
    group by calendar_year
    having count(*) >= $11::integer
       and abs(coalesce(corr(value_a, value_b), 0)) >= $12::double precision
    order by calendar_year
  `;
  const params = [
    JSON.stringify(a.category_filters ?? {}),
    a.measure_key,
    a.dataset_code,
    geographyType,
    options.year,
    JSON.stringify(b.category_filters ?? {}),
    b.measure_key,
    b.dataset_code,
    geographyType,
    options.year,
    options.minObservations,
    options.minAbsPearson,
  ];
  const { rows } = await client.query(sql, params);
  return rows.map((row) => ({
    metric_code_a: a.metric_code,
    metric_code_b: b.metric_code,
    measure_key_a: a.measure_key,
    measure_key_b: b.measure_key,
    dataset_code_a: a.dataset_code,
    dataset_code_b: b.dataset_code,
    domain_id_a: a.domain_id,
    domain_id_b: b.domain_id,
    label_a: a.label,
    label_b: b.label,
    unit_code_a: a.unit_code,
    unit_code_b: b.unit_code,
    grain: grainFor(geographyType),
    geography_type: geographyType,
    period_type: "year",
    calendar_year: row.calendar_year,
    observation_count: row.observation_count,
    geography_count: row.geography_count,
    pearson_correlation: row.pearson_correlation == null ? null : Number(row.pearson_correlation),
    metadata: {
      category_filters_a: a.category_filters ?? {},
      category_filters_b: b.category_filters ?? {},
      source_a: a.source,
      source_b: b.source,
      metadata_origin_a: a.metadata_origin,
      metadata_origin_b: b.metadata_origin,
    },
  }));
}

async function upsertProfiles(client, profiles) {
  if (!profiles.length) return 0;
  const values = [];
  const params = [];
  for (const profile of profiles) {
    const pearson = profile.pearson_correlation;
    const direction = relationshipDirection(pearson);
    const strength = relationshipStrength(pearson);
    const quality = qualityStatus(profile.observation_count, pearson);
    const warning = "Pearson correlation is descriptive association only. It is not causal evidence.";
    const base = params.length;
    params.push(
      profile.metric_code_a,
      profile.metric_code_b,
      profile.measure_key_a,
      profile.measure_key_b,
      profile.dataset_code_a,
      profile.dataset_code_b,
      profile.domain_id_a,
      profile.domain_id_b,
      profile.label_a,
      profile.label_b,
      profile.unit_code_a,
      profile.unit_code_b,
      profile.grain,
      profile.geography_type,
      profile.period_type,
      profile.calendar_year,
      profile.observation_count,
      profile.geography_count,
      pearson,
      direction,
      strength,
      quality,
      warning,
      JSON.stringify(profile.metadata ?? {})
    );
    values.push(`(${Array.from({ length: 24 }, (_, index) => `$${base + index + 1}`).join(", ")})`);
  }
  const { rowCount } = await client.query(
    `
      insert into semantic.metric_relationship_profile (
        metric_code_a, metric_code_b, measure_key_a, measure_key_b, dataset_code_a, dataset_code_b,
        domain_id_a, domain_id_b, label_a, label_b, unit_code_a, unit_code_b,
        grain, geography_type, period_type, calendar_year, observation_count, geography_count,
        pearson_correlation, relationship_direction, relationship_strength, quality_status,
        interpretation_warning, metadata
      )
      values ${values.join(",\n")}
      on conflict (metric_code_a, metric_code_b, grain, calendar_year)
      do update set
        measure_key_a = excluded.measure_key_a,
        measure_key_b = excluded.measure_key_b,
        dataset_code_a = excluded.dataset_code_a,
        dataset_code_b = excluded.dataset_code_b,
        domain_id_a = excluded.domain_id_a,
        domain_id_b = excluded.domain_id_b,
        label_a = excluded.label_a,
        label_b = excluded.label_b,
        unit_code_a = excluded.unit_code_a,
        unit_code_b = excluded.unit_code_b,
        observation_count = excluded.observation_count,
        geography_count = excluded.geography_count,
        pearson_correlation = excluded.pearson_correlation,
        relationship_direction = excluded.relationship_direction,
        relationship_strength = excluded.relationship_strength,
        quality_status = excluded.quality_status,
        interpretation_warning = excluded.interpretation_warning,
        metadata = excluded.metadata,
        computed_at = now()
    `,
    params
  );
  return rowCount ?? 0;
}

function candidatePairs(contracts, options) {
  const pairs = [];
  for (let leftIndex = 0; leftIndex < contracts.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < contracts.length; rightIndex += 1) {
      const left = contracts[leftIndex];
      const right = contracts[rightIndex];
      if (left.measure_key === right.measure_key) continue;
      if (options.crossDomainOnly && left.domain_id === right.domain_id) continue;
      if (!options.includeSameDomain && left.domain_id === right.domain_id) continue;
      const sharedGeographyTypes = left.geography_types.filter((type) => right.geography_types.includes(type));
      for (const geographyType of sharedGeographyTypes) {
        if (options.geographyType && geographyType !== options.geographyType) continue;
        pairs.push({ left, right, geographyType });
        if (options.limitPairs && pairs.length >= options.limitPairs) return pairs;
      }
    }
  }
  return pairs;
}

async function printTopProfiles(client, options) {
  const { rows } = await client.query(
    `
      select
        metric_code_a,
        metric_code_b,
        label_a,
        label_b,
        domain_id_a,
        domain_id_b,
        grain,
        calendar_year,
        observation_count,
        round(pearson_correlation::numeric, 4) as pearson_correlation,
        relationship_direction,
        relationship_strength,
        quality_status
      from semantic.metric_relationship_profile
      where abs(pearson_correlation) >= $1
      order by abs(pearson_correlation) desc nulls last, observation_count desc
      limit $2
    `,
    [options.strongThreshold, options.top]
  );
  if (!rows.length) {
    console.log(`No relationship profiles found with abs(Pearson) >= ${options.strongThreshold}.`);
    return;
  }
  console.table(rows);
}

async function main() {
  loadLocalEnv();
  const options = parseArgs(process.argv);
  const client = createPostgresClient({
    applicationName: "guara-load-semantic-relationships",
    statementTimeoutMs: options.statementTimeoutMs,
  });

  try {
    await client.connect();
    if (options.ensureSchema) await ensureSchema(client);
    const contracts = await fetchContracts(client, options);
    const pairs = candidatePairs(contracts, options);
    console.log(`Selected ${contracts.length} executable semantic metric contract(s).`);
    console.log(`Profiling ${pairs.length} metric pair/grain candidate(s).`);

    let stored = 0;
    let produced = 0;
    let failed = 0;
    for (let index = 0; index < pairs.length; index += 1) {
      const pair = pairs[index];
      try {
        const profiles = await profilePair(client, pair.left, pair.right, pair.geographyType, options);
        produced += profiles.length;
        stored += await upsertProfiles(client, profiles);
        if ((index + 1) % 25 === 0 || profiles.length) {
          console.log(`Profiled ${index + 1}/${pairs.length}: ${pair.left.metric_code} × ${pair.right.metric_code} @ ${pair.geographyType}, ${profiles.length} year profile(s).`);
        }
      } catch (error) {
        failed += 1;
        console.warn(`Skipped ${pair.left.metric_code} × ${pair.right.metric_code} @ ${pair.geographyType}: ${error.message}`);
      }
    }

    console.log(`Relationship profiling complete. Produced ${produced} profile(s), upserted ${stored} row operation(s), skipped ${failed} failed pair(s).`);
    await printTopProfiles(client, options);
  } catch (error) {
    console.error(explainPostgresConnectionError(error));
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
