{{ config(
  materialized='incremental',
  unique_key=['dataset_code', 'measure_key', 'geography_type', 'period_type'],
  on_schema_change='sync_all_columns',
  pre_hook=delete_dataset_scope()
) }}

select
  dataset_key,
  dataset_code,
  measure_key,
  geography_type,
  period_type,
  min_year,
  max_year,
  fact_row_count,
  geography_count,
  period_count,
  true as is_supported,
  'generated'::text as metadata_origin,
  now() as generated_at
from {{ ref('semantic_fact_profile_rollup') }}
where geography_type is not null
  and period_type is not null
