{{ config(
  materialized='incremental',
  unique_key='dataset_code',
  on_schema_change='sync_all_columns',
  pre_hook=delete_dataset_scope()
) }}

with fact_profile as (
  select
    dataset_key,
    dataset_code,
    sum(fact_row_count)::bigint as fact_row_count,
    sum(populated_fact_row_count)::bigint as populated_fact_row_count,
    count(distinct measure_key)::integer as measure_count,
    null::integer as geography_count,
    null::integer as period_count,
    min(min_year)::integer as min_year,
    max(max_year)::integer as max_year,
    array_agg(distinct geography_type order by geography_type) filter (where geography_type is not null) as geography_types,
    array_agg(distinct period_type order by period_type) filter (where period_type is not null) as period_types,
    case
      when bool_or(profile_depth = 'fact_profiled') then 'fact_profiled'
      when bool_or(profile_depth = 'sample_profiled') then 'sample_profiled'
      else 'metadata_only'
    end as profile_depth
  from {{ ref('semantic_fact_profile_rollup') }}
  group by dataset_key, dataset_code
),
dimension_profile as (
  select
    dataset_key,
    dataset_code,
    count(distinct dimension_code)::integer as dimension_count,
    array_agg(distinct dimension_code order by dimension_code) as dimension_codes
  from {{ ref('stg_gold_bouwen_wonen_categories') }}
  where is_unknown = false
  group by dataset_key, dataset_code
)
select
  d.dataset_key,
  d.dataset_code,
  d.dataset_title,
  d.dataset_description,
  d.domain_id,
  d.domain_name,
  d.source_system,
  d.source_organization,
  d.source_url,
  d.dataset_version,
  d.last_updated_at_source,
  d.loaded_at,
  coalesce(fp.fact_row_count, 0)::bigint as fact_row_count,
  coalesce(fp.populated_fact_row_count, 0)::bigint as populated_fact_row_count,
  coalesce(fp.measure_count, 0)::integer as measure_count,
  coalesce(dp.dimension_count, 0)::integer as dimension_count,
  coalesce(fp.geography_count, 0)::integer as geography_count,
  coalesce(fp.period_count, 0)::integer as period_count,
  fp.min_year,
  fp.max_year,
  coalesce(fp.geography_types, array[]::text[]) as geography_types,
  coalesce(fp.period_types, array[]::text[]) as period_types,
  coalesce(dp.dimension_codes, array[]::text[]) as dimension_codes,
  case
    when coalesce(fp.fact_row_count, 0) = 0 then 'not_loaded'
    when coalesce(fp.populated_fact_row_count, 0) = 0 then 'loaded_no_values'
    else 'loaded'
  end as data_availability_status,
  case
    when coalesce(fp.fact_row_count, 0) = 0 then 'metadata_only'
    else coalesce(fp.profile_depth, 'sample_profiled')
  end as profile_depth,
  'generated'::text as metadata_origin,
  now() as generated_at
from {{ ref('stg_gold_bouwen_wonen_datasets') }} d
left join fact_profile fp
  on fp.dataset_key = d.dataset_key
left join dimension_profile dp
  on dp.dataset_key = d.dataset_key
