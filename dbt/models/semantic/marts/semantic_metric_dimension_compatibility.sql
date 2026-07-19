{{ config(
  materialized='incremental',
  unique_key=['dataset_code', 'measure_key', 'dimension_code'],
  on_schema_change='sync_all_columns',
  pre_hook=delete_dataset_scope()
) }}

select
  mp.dataset_code,
  mp.measure_key,
  mp.measure_name,
  dp.dimension_code,
  dp.dimension_role,
  case
    when dp.dimension_role in ('category', 'geography', 'time') then true
    else false
  end as supports_grouping,
  case
    when dp.has_total_category or dp.dimension_role in ('geography', 'time') then true
    else false
  end as supports_filtering,
  mp.can_enable_metric,
  'generated'::text as metadata_origin,
  now() as generated_at
from {{ ref('semantic_measure_profile') }} mp
join {{ ref('semantic_dimension_profile') }} dp
  on dp.dataset_code = mp.dataset_code
