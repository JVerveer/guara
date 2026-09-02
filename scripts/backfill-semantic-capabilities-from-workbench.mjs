#!/usr/bin/env node
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

const MARTS = {
  "bouwen-en-wonen": {
    martSchema: "gold_bouwen_wonen",
    factTable: "fact_housing_observation",
    datasetDim: "dim_housing_dataset",
    indicatorDim: "dim_housing_indicator",
  },
  "inkomen-en-bestedingen": {
    martSchema: "gold_inkomen_bestedingen",
    factTable: "fact_income_observation",
    datasetDim: "dim_income_dataset",
    indicatorDim: "dim_income_indicator",
  },
};

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function sqlIdentifier(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${value}"`;
}

async function createRun(client, domain) {
  const { rows } = await client.query(
    `
      insert into semantic.gold_capability_run (status, mart_filter, domain_filter)
      values ('running', 'workbench-capability-backfill', $1)
      returning capability_run_id
    `,
    [domain || null]
  );
  return rows[0].capability_run_id;
}

async function finishRun(client, runId, status, measureCount, errorMessage = null) {
  await client.query(
    `
      update semantic.gold_capability_run
      set status = $2,
          finished_at = now(),
          measure_count = $3,
          error_message = $4
      where capability_run_id = $1
    `,
    [runId, status, measureCount, errorMessage]
  );
}

async function backfillDomain(client, domainId, mart, runId) {
  const datasetDim = `${sqlIdentifier(mart.martSchema)}.${sqlIdentifier(mart.datasetDim)}`;
  const indicatorDim = `${sqlIdentifier(mart.martSchema)}.${sqlIdentifier(mart.indicatorDim)}`;

  const { rowCount } = await client.query(
    `
      with missing_profiles as (
        select p.*
        from semantic.workbench_measure_profile p
        left join semantic.gold_measure_capability c
          on c.domain_id = p.domain_id
         and upper(c.dataset_code) = upper(p.dataset_code)
         and c.measure_key = p.measure_key
        where p.domain_id = $1
          and p.populated_fact_rows > 0
          and c.measure_key is null
      ),
      source_measures as (
        select
          p.domain_id,
          p.dataset_code,
          p.measure_key,
          i.measure_code,
          i.indicator_name as measure_name,
          i.indicator_description as measure_description,
          i.unit_code,
          i.unit_name,
          u.unit_category,
          u.scale_factor,
          i.default_aggregation,
          i.value_type,
          i.is_additive,
          i.is_non_additive,
          greatest(p.loaded_fact_rows, p.populated_fact_rows, 1)::bigint as loaded_fact_rows,
          greatest(p.populated_fact_rows, 1)::bigint as populated_fact_rows,
          p.min_year,
          p.max_year,
          p.available_years,
          case
            when exists (select 1 from unnest(coalesce(p.grains, '{}'::text[])) grain where grain like '%_quarter') then array['quarter']::text[]
            when exists (select 1 from unnest(coalesce(p.grains, '{}'::text[])) grain where grain like '%_month') then array['month']::text[]
            else array['year']::text[]
          end as period_types,
          p.geography_types,
          p.grains
        from missing_profiles p
        join ${indicatorDim} i on i.measure_key = p.measure_key
        join ${datasetDim} d on d.dataset_key = i.dataset_key
        left join gold.dim_unit u on u.unit_key = i.unit_key
        where upper(d.dataset_code) = upper(p.dataset_code)
      )
      insert into semantic.gold_measure_capability (
        domain_id, mart_schema, fact_table, dataset_code, measure_key, measure_code, measure_name,
        measure_description, unit_code, unit_name, unit_category, scale_factor, default_aggregation,
        value_type, is_additive, is_non_additive, loaded_fact_rows, populated_fact_rows, min_year,
        max_year, available_years, period_types, geography_types, grains, supports_national_year,
        supports_province_year, supports_region_year, supports_municipality_year, supports_trend,
        supports_ranking, supports_comparison, executable_candidate, non_executable_reasons,
        metadata, last_profiled_at, capability_run_id
      )
      select
        domain_id,
        $2,
        $3,
        dataset_code,
        measure_key,
        measure_code,
        measure_name,
        measure_description,
        unit_code,
        unit_name,
        unit_category,
        scale_factor,
        default_aggregation,
        value_type,
        is_additive,
        is_non_additive,
        loaded_fact_rows,
        populated_fact_rows,
        min_year,
        max_year,
        available_years,
        period_types,
        geography_types,
        grains,
        'national_year' = any(grains),
        'province_year' = any(grains),
        'region_year' = any(grains) or 'corop_year' = any(grains),
        'municipality_year' = any(grains),
        coalesce(array_length(available_years, 1), 0) > 1,
        exists (select 1 from unnest(grains) g where g in ('municipality_year', 'province_year', 'region_year', 'corop_year')),
        exists (select 1 from unnest(grains) g where g in ('municipality_year', 'province_year', 'region_year', 'corop_year', 'national_year')),
        populated_fact_rows > 0
          and default_aggregation is not null
          and default_aggregation <> 'none'
          and exists (select 1 from unnest(grains) g where g in ('municipality_year', 'province_year', 'region_year', 'corop_year', 'national_year')),
        array_remove(array[
          case when populated_fact_rows = 0 then 'no_populated_facts' end,
          case when default_aggregation is null or default_aggregation = 'none' then 'missing_safe_aggregation' end,
          case when not exists (select 1 from unnest(grains) g where g in ('municipality_year', 'province_year', 'region_year', 'corop_year', 'national_year')) then 'unsupported_grain' end
        ], null),
        jsonb_build_object(
          'profile_source', 'workbench_profile_backfill',
          'metadata_origin', 'generated',
          'row_count_scope', 'workbench_profile_minimum',
          'derived_from_layers', jsonb_build_array('cbs_api', 'bronze', 'silver', 'gold'),
          'backfill_note', 'Created without heavy fact-row counting because Workbench profile already detected populated Gold values.'
        ),
        now(),
        $4::uuid
      from source_measures
      on conflict (domain_id, mart_schema, fact_table, dataset_code, measure_key) do nothing
    `,
    [domainId, mart.martSchema, mart.factTable, runId]
  );

  return rowCount ?? 0;
}

async function repairContractsFromProfiles(client, domainId) {
  await client.query("drop table if exists semantic_contract_measure_key_repair_candidates");
  await client.query(
    `
      create temporary table semantic_contract_measure_key_repair_candidates (
        metric_code text primary key,
        domain_id text not null,
        old_measure_key bigint not null,
        new_measure_key bigint not null,
        dataset_code text not null
      ) on commit preserve rows
    `
  );

  const { rowCount: candidateCount } = await client.query(
    `
      insert into semantic_contract_measure_key_repair_candidates (
        metric_code, domain_id, old_measure_key, new_measure_key, dataset_code
      )
      with candidates as (
        select
          mc.metric_code,
          mc.domain_id,
          mc.measure_key as old_measure_key,
          p.measure_key as new_measure_key,
          p.dataset_code,
          count(*) over (partition by mc.metric_code) as candidate_count
        from semantic.metric_contract mc
        join semantic.workbench_measure_profile p
          on p.domain_id = mc.domain_id
         and lower(p.dataset_code) = lower(mc.dataset_codes[1])
         and p.measure_key between mc.measure_key - 2048 and mc.measure_key + 2048
         and p.measure_key <> mc.measure_key
        join gold_inkomen_bestedingen.dim_income_indicator i
          on i.measure_key = p.measure_key
         and i.indicator_name = mc.label
        where mc.domain_id = $1
          and mc.is_active
      )
      select metric_code, domain_id, old_measure_key, new_measure_key, dataset_code
      from candidates
      where candidate_count = 1
    `,
    [domainId]
  );

  if (candidateCount) {
    await client.query(
      `
        update semantic.metric_contract mc
        set measure_key = r.new_measure_key,
            updated_at = now()
        from semantic_contract_measure_key_repair_candidates r
        where mc.metric_code = r.metric_code
          and mc.measure_key = r.old_measure_key
      `
    );

    await client.query(
      `
        update semantic.concept_metric_binding b
        set measure_key = r.new_measure_key,
            updated_at = now()
        from semantic_contract_measure_key_repair_candidates r
        where b.metric_code = r.metric_code
          and b.measure_key = r.old_measure_key
      `
    );

    await client.query(
      `
        update semantic.metric_contract_review rv
        set measure_key = r.new_measure_key,
            updated_at = now()
        from semantic_contract_measure_key_repair_candidates r
        where rv.metric_code = r.metric_code
          and rv.measure_key = r.old_measure_key
      `
    );

    await client.query(
      `
        update semantic.metric_ai_review ar
        set measure_key = r.new_measure_key,
            updated_at = now()
        from semantic_contract_measure_key_repair_candidates r
        where ar.metric_code = r.metric_code
          and ar.measure_key = r.old_measure_key
      `
    );

    await client.query(
      `
        update semantic.category_value_contract cvc
        set measure_key = r.new_measure_key,
            updated_at = now()
        from semantic_contract_measure_key_repair_candidates r
        where cvc.metric_code = r.metric_code
          and cvc.measure_key = r.old_measure_key
      `
    );

    await client.query(
      `
        update semantic.contract_availability ca
        set measure_key = r.new_measure_key,
            checked_at = now()
        from semantic_contract_measure_key_repair_candidates r
        where ca.metric_code = r.metric_code
          and ca.measure_key = r.old_measure_key
      `
    );

    await client.query(
      `
        update semantic.metric_contract_observation o
        set measure_key = r.new_measure_key
        from semantic_contract_measure_key_repair_candidates r
        where o.metric_code = r.metric_code
          and o.measure_key = r.old_measure_key
      `
    );
  }

  const { rowCount } = await client.query(
    `
      update semantic.metric_contract mc
      set
        valid_grains = case
          when coalesce(array_length(mc.valid_grains, 1), 0) = 0
           and coalesce(array_length(p.grains, 1), 0) > 0
          then p.grains
          else mc.valid_grains
        end,
        default_grain = case
          when mc.default_grain is null
           and coalesce(array_length(p.grains, 1), 0) > 0
          then coalesce(
            (select grain from unnest(p.grains) grain where grain = 'municipality_year' limit 1),
            (select grain from unnest(p.grains) grain where grain = 'province_year' limit 1),
            (select grain from unnest(p.grains) grain where grain = 'corop_year' limit 1),
            (select grain from unnest(p.grains) grain where grain = 'landsdeel_year' limit 1),
            (select grain from unnest(p.grains) grain where grain in ('country_year', 'national_year') limit 1),
            p.grains[1]
          )
          else mc.default_grain
        end,
        availability_status = case
          when coalesce(p.populated_fact_rows, 0) > 0 then 'available'
          else coalesce(mc.availability_status, 'unknown')
        end,
        availability_checked_at = case
          when coalesce(p.populated_fact_rows, 0) > 0 then now()
          else mc.availability_checked_at
        end,
        updated_at = now()
      from semantic.workbench_measure_profile p
      where mc.domain_id = $1
        and p.domain_id = mc.domain_id
        and p.measure_key = mc.measure_key
        and lower(p.dataset_code) = lower(mc.dataset_codes[1])
        and mc.is_active
        and (
          coalesce(array_length(mc.valid_grains, 1), 0) = 0
          or mc.default_grain is null
          or mc.availability_status is null
        )
    `,
    [domainId]
  );
  return { repairedKeys: candidateCount ?? 0, repairedContracts: rowCount ?? 0 };
}

async function main() {
  loadLocalEnv();
  const domain = argValue("domain", "");
  const selected = Object.entries(MARTS).filter(([domainId]) => !domain || domain === domainId);
  if (!selected.length) throw new Error(`Unknown domain: ${domain}`);

  const client = createPostgresClient({
    applicationName: "guara-semantic-capability-backfill",
    statementTimeoutMs: 600000,
    queryTimeoutMs: 600000,
  });

  let runId = null;
  let total = 0;
  await client.connect();
  try {
    runId = await createRun(client, domain);
    for (const [domainId, mart] of selected) {
      const count = await backfillDomain(client, domainId, mart, runId);
      const repaired = await repairContractsFromProfiles(client, domainId);
      total += count;
      console.log(`Backfilled semantic Gold measure capabilities for ${domainId}: ${count} row(s), repaired ${repaired.repairedKeys} measure key(s), repaired ${repaired.repairedContracts} contract(s) from Workbench profiles.`);
    }
    await finishRun(client, runId, "complete", total);
    console.log(`Semantic capability backfill complete: ${total} row(s).`);
  } catch (error) {
    if (runId) await finishRun(client, runId, "failed", total, error.message).catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(explainPostgresConnectionError(error));
  process.exitCode = 1;
});
