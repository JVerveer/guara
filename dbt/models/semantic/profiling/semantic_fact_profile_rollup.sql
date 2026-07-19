{{ config(
  materialized='incremental',
  unique_key=['dataset_code', 'measure_key', 'geography_type', 'period_type'],
  on_schema_change='sync_all_columns',
  pre_hook=delete_dataset_scope()
) }}

select
{% if var("semantic_profile_facts", true) %}
  f.dataset_key,
  f.dataset_code,
  f.measure_key,
  coalesce(f.geography_type, 'unknown') as geography_type,
  coalesce(f.period_type, 'unknown') as period_type,
  min(f.calendar_year)::integer as min_year,
  max(f.calendar_year)::integer as max_year,
  count(*)::bigint as fact_row_count,
  count(*) filter (where f.observation_value is not null and f.is_missing = false)::bigint as populated_fact_row_count,
  null::integer as geography_count,
  null::integer as period_count,
  min(f.observation_value) filter (where f.observation_value is not null and f.is_missing = false) as min_value,
  max(f.observation_value) filter (where f.observation_value is not null and f.is_missing = false) as max_value
from {{ ref('stg_gold_bouwen_wonen_fact_profile_base') }} f
group by
  f.dataset_key,
  f.dataset_code,
  f.measure_key,
  coalesce(f.geography_type, 'unknown'),
  coalesce(f.period_type, 'unknown')
{% else %}
  m.dataset_key,
  m.dataset_code,
  m.measure_key,
  'unknown'::text as geography_type,
  'unknown'::text as period_type,
  null::integer as min_year,
  null::integer as max_year,
  0::bigint as fact_row_count,
  0::bigint as populated_fact_row_count,
  null::integer as geography_count,
  null::integer as period_count,
  null::numeric as min_value,
  null::numeric as max_value
from {{ ref('stg_gold_bouwen_wonen_measures') }} m
{% endif %}
