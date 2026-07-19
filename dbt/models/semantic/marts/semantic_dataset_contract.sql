{{ config(
  materialized='incremental',
  unique_key='dataset_code',
  on_schema_change='sync_all_columns',
  pre_hook=delete_dataset_scope()
) }}

with dataset_profile as (
  select * from {{ ref('semantic_dataset_profile') }}
),
measure_profile as (
  select * from {{ ref('semantic_measure_profile') }}
),
dimension_profile as (
  select * from {{ ref('semantic_dimension_profile') }}
),
default_measure as (
  select distinct on (dataset_code)
    dataset_code,
    measure_key as default_measure_key,
    measure_name as default_measure_name,
    unit_code as default_unit_code
  from measure_profile
  where populated_fact_row_count > 0
     or profile_depth = 'metadata_only'
  order by
    dataset_code,
    case when populated_fact_row_count > 0 then 0 else 1 end,
    case
      when lower(measure_name) like '%totaal%' then 0
      when lower(measure_name) like '%beginstand%' then 1
      when unit_code = 'COUNT' then 2
      else 10
    end,
    populated_fact_row_count desc
),
default_breakdown as (
  select distinct on (dataset_code)
    dataset_code,
    dimension_code as default_breakdown_dimension
  from dimension_profile
  where dimension_role = 'category'
    and category_count > 1
  order by
    dataset_code,
    case
      when lower(dimension_code) like '%type%' then 0
      when total_category_count > 0 then 1
      else 10
    end,
    category_count desc
),
default_filter as (
  select distinct on (dp.dataset_code)
    dp.dataset_code,
    dp.dimension_code as default_filter_dimension,
    dp.total_category_names[1] as default_filter_value
  from dimension_profile
  dp
  left join default_breakdown db
    on db.dataset_code = dp.dataset_code
  where dp.total_category_count > 0
    and dp.dimension_code <> coalesce(db.default_breakdown_dimension, '')
  order by
    dp.dataset_code,
    case
      when lower(dp.dimension_code) like '%kenmerk%' then 0
      when lower(dp.dimension_code) like '%totaal%' then 1
      else 10
    end,
    dp.total_category_count desc,
    dp.dimension_code
)
select
  dp.dataset_key,
  dp.dataset_code,
  dp.dataset_title,
  dp.domain_id,
  dp.data_availability_status,
  dp.profile_depth,
  dm.default_measure_key,
  dm.default_measure_name,
  dm.default_unit_code,
  db.default_breakdown_dimension,
  df.default_filter_dimension,
  df.default_filter_value,
  dp.geography_types,
  dp.period_types,
  dp.dimension_codes,
  dp.min_year,
  dp.max_year,
  array_remove(array[
    case when dm.default_measure_key is not null then 'lookup_value' end,
    case when 'municipality' = any(dp.geography_types) then 'rank_geographies' end,
    case when 'municipality' = any(dp.geography_types) then 'compare_geographies' end,
    case when db.default_breakdown_dimension is not null then 'category_breakdown' end,
    case when dp.period_count > 1 then 'trend' end
  ], null) as supported_query_shapes,
  case
    when dm.default_measure_key is null then 'incomplete'
    when dp.profile_depth = 'metadata_only' then 'metadata_only'
    when db.default_breakdown_dimension is not null then 'complete'
    else 'usable'
  end as contract_status,
  'generated'::text as metadata_origin,
  now() as generated_at
from dataset_profile dp
left join default_measure dm
  on dm.dataset_code = dp.dataset_code
left join default_breakdown db
  on db.dataset_code = dp.dataset_code
left join default_filter df
  on df.dataset_code = dp.dataset_code
 and df.default_filter_dimension <> db.default_breakdown_dimension
