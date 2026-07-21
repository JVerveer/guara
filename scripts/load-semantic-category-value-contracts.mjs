#!/usr/bin/env node
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function loadCategoryValueContracts(client, { domain, dataset, includeUnknown }) {
  const params = [domain, dataset, includeUnknown];
  const { rowCount } = await client.query(`
    with source_values as (
      select
        cp.dataset_code,
        coalesce(dc.domain_id, $1) as domain_id,
        cp.dimension_code,
        cp.category_code,
        cp.category_key,
        cp.category_name,
        cp.category_description,
        cp.is_total,
        (
          cp.is_unknown
          or lower(cp.category_name) like '%onbekend%'
          or lower(cp.category_name) like '%unknown%'
        ) as is_unknown,
        dc.default_measure_key,
        dc.default_measure_name,
        dc.default_unit_code,
        dc.default_filter_dimension,
        dc.default_filter_value,
        dc.geography_types,
        dp.dimension_role
      from semantic.semantic_category_profile cp
      join semantic.semantic_dimension_profile dp
        on dp.dataset_code = cp.dataset_code
       and dp.dimension_code = cp.dimension_code
      join semantic.semantic_dataset_contract dc
        on dc.dataset_code = cp.dataset_code
      where dp.dimension_role = 'category'
        and dc.default_measure_key is not null
        and ($1::text is null or dc.domain_id = $1)
        and ($2::text is null or cp.dataset_code = $2)
        and (
          $3::boolean
          or not (
            cp.is_unknown
            or lower(cp.category_name) like '%onbekend%'
            or lower(cp.category_name) like '%unknown%'
          )
        )
    ),
    normalized as (
      select
        *,
        lower(regexp_replace(dataset_code || '_' || dimension_code || '_' || coalesce(category_code, category_key::text), '[^a-zA-Z0-9]+', '_', 'g')) as contract_suffix,
        array_remove(array[
          case when 'municipality' = any(geography_types) then 'municipality_year' end,
          case when 'region' = any(geography_types) then 'region_year' end,
          case when 'province' = any(geography_types) then 'province_year' end,
          case when 'country' = any(geography_types) then 'national_year' end
        ], null) as valid_grains,
        case
          when 'municipality' = any(geography_types) then 'municipality_year'
          when 'region' = any(geography_types) then 'region_year'
          when 'province' = any(geography_types) then 'province_year'
          when 'country' = any(geography_types) then 'national_year'
          else null
        end as default_grain
      from source_values
    ),
    with_filters as (
      select
        *,
        jsonb_strip_nulls(
          case
            when default_filter_dimension is not null
             and default_filter_value is not null
             and lower(default_filter_dimension) <> lower(dimension_code)
            then jsonb_build_object(default_filter_dimension, default_filter_value)
            else '{}'::jsonb
          end
          || jsonb_build_object(dimension_code, category_name)
        ) as category_filters
      from normalized
    )
    insert into semantic.category_value_contract (
      contract_code,
      domain_id,
      dataset_code,
      metric_code,
      measure_key,
      measure_name,
      unit_code,
      aggregation,
      dimension_code,
      category_code,
      category_name,
      label,
      description,
      synonyms,
      category_filters,
      valid_grains,
      default_grain,
      supports,
      is_total,
      is_unknown,
      selection_priority,
      metadata_origin,
      contract_status,
      execution_status,
      semantic_quality_status,
      is_active,
      updated_at
    )
    select
      'category_' || contract_suffix as contract_code,
      domain_id,
      dataset_code,
      'category_' || contract_suffix as metric_code,
      default_measure_key,
      default_measure_name,
      default_unit_code,
      case
        when default_unit_code in ('PERCENT', 'PERCENTAGE', '%') then 'none'
        when lower(coalesce(default_measure_name, '')) like '%gemiddeld%' then 'average'
        when lower(coalesce(default_measure_name, '')) like '%mediaan%' then 'median'
        else 'sum'
      end as aggregation,
      dimension_code,
      category_code,
      category_name,
      category_name as label,
      coalesce(category_description, 'Generated selectable category value contract from semantic category profile.'),
      jsonb_build_object(
        'nl',
        array_remove(array[
          category_name,
          lower(category_name),
          replace(category_name, '-', ' '),
          case when lower(category_name) like '%woning' then category_name || 'en' end,
          case when lower(category_name) like '% woningen' then regexp_replace(category_name, 'en$', '', 'i') end
        ], null),
        'en',
        array[]::text[]
      ) as synonyms,
      category_filters,
      valid_grains,
      default_grain,
      jsonb_build_object(
        'ranking', true,
        'comparison', true,
        'trend', true,
        'percentage_change', true
      ) as supports,
      is_total,
      is_unknown,
      case
        when is_unknown then 500
        when is_total then 120
        else 60
      end as selection_priority,
      'generated',
      case when is_unknown then 'profiled' else 'profiled' end,
      case when is_unknown then 'disabled' else 'enabled' end,
      case when is_unknown then 'category_value_unknown' else 'category_value_profiled' end,
      true,
      now()
    from with_filters
    on conflict (dataset_code, measure_key, dimension_code, category_code) do update set
      contract_code = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.contract_code else excluded.contract_code end,
      metric_code = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.metric_code else excluded.metric_code end,
      measure_name = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.measure_name else excluded.measure_name end,
      unit_code = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.unit_code else excluded.unit_code end,
      aggregation = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.aggregation else excluded.aggregation end,
      category_name = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.category_name else excluded.category_name end,
      label = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.label else excluded.label end,
      description = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.description else excluded.description end,
      synonyms = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.synonyms else excluded.synonyms end,
      category_filters = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.category_filters else excluded.category_filters end,
      valid_grains = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.valid_grains else excluded.valid_grains end,
      default_grain = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.default_grain else excluded.default_grain end,
      supports = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.supports else excluded.supports end,
      is_total = excluded.is_total,
      is_unknown = excluded.is_unknown,
      selection_priority = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.selection_priority else excluded.selection_priority end,
      contract_status = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.contract_status else excluded.contract_status end,
      execution_status = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.execution_status else excluded.execution_status end,
      semantic_quality_status = case when semantic.category_value_contract.metadata_origin = 'curated' then semantic.category_value_contract.semantic_quality_status else excluded.semantic_quality_status end,
      is_active = true,
      updated_at = now()
  `, params);
  await client.query(`
    update semantic.category_value_contract
    set
      is_unknown = true,
      execution_status = 'disabled',
      semantic_quality_status = 'category_value_unknown',
      updated_at = now()
    where metadata_origin <> 'curated'
      and ($1::text is null or domain_id = $1)
      and ($2::text is null or dataset_code = $2)
      and (
        lower(category_name) like '%onbekend%'
        or lower(category_name) like '%unknown%'
      )
  `, [domain, dataset]);
  return rowCount ?? 0;
}

async function main() {
  loadLocalEnv();
  const client = createPostgresClient({
    applicationName: "guara-semantic-category-value-contract-loader",
    statementTimeoutMs: 600000,
    queryTimeoutMs: 600000,
  });
  await client.connect();
  try {
    const domain = argValue("domain", "bouwen-en-wonen");
    const dataset = argValue("dataset", null);
    const includeUnknown = hasFlag("include-unknown");
    const count = await loadCategoryValueContracts(client, { domain, dataset, includeUnknown });
    await client.query("notify pgrst, 'reload schema'");
    console.log(`Loaded semantic category value contracts: ${count} upserted${dataset ? ` for ${dataset}` : ""}.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(explainPostgresConnectionError(error));
  process.exitCode = 1;
});
