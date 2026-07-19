{{ config(
  materialized='incremental',
  unique_key='measure_key',
  on_schema_change='sync_all_columns',
  pre_hook=delete_dataset_scope()
) }}

with fact_profile as (
  select
    dataset_key,
    dataset_code,
    measure_key,
    sum(fact_row_count)::bigint as fact_row_count,
    sum(populated_fact_row_count)::bigint as populated_fact_row_count,
    min(min_year)::integer as min_year,
    max(max_year)::integer as max_year,
    null::integer as geography_count,
    null::integer as period_count,
    array_agg(distinct geography_type order by geography_type) filter (where geography_type is not null) as geography_types,
    array_agg(distinct period_type order by period_type) filter (where period_type is not null) as period_types,
    min(min_value) as min_value,
    max(max_value) as max_value
  from {{ ref('semantic_fact_profile_rollup') }}
  group by dataset_key, dataset_code, measure_key
)
select
  m.dataset_key,
  m.dataset_code,
  m.measure_key,
  m.measure_code,
  m.measure_name,
  m.measure_description,
  m.topic,
  m.subtopic,
  m.unit_key,
  m.unit_code,
  m.unit_name,
  m.unit_category,
  m.scale_factor,
  m.default_aggregation,
  m.is_additive,
  m.is_non_additive,
  m.value_type,
  coalesce(fp.fact_row_count, 0)::bigint as fact_row_count,
  coalesce(fp.populated_fact_row_count, 0)::bigint as populated_fact_row_count,
  fp.min_year,
  fp.max_year,
  coalesce(fp.geography_types, array[]::text[]) as geography_types,
  coalesce(fp.period_types, array[]::text[]) as period_types,
  coalesce(fp.geography_count, 0)::integer as geography_count,
  coalesce(fp.period_count, 0)::integer as period_count,
  fp.min_value,
  fp.max_value,
  case
    when m.is_additive then 'sum'
    when m.is_non_additive then 'max'
    else 'none'
  end as suggested_aggregation,
  case
    when m.default_aggregation in ('sum', 'avg', 'max', 'min', 'count') then true
    when m.is_additive or m.is_non_additive then true
    else false
  end as can_enable_metric,
  case
    when coalesce(fp.fact_row_count, 0) = 0 then 'metadata_only'
    else 'fact_profiled'
  end as profile_depth,
  'generated'::text as metadata_origin,
  now() as generated_at
from {{ ref('stg_gold_bouwen_wonen_measures') }} m
left join fact_profile fp
  on fp.measure_key = m.measure_key
