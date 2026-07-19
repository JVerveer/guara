{{ config(
  materialized='incremental',
  unique_key='category_key',
  on_schema_change='sync_all_columns',
  pre_hook=delete_dataset_scope()
) }}

select
  dataset_key,
  dataset_code,
  dimension_code,
  category_key,
  category_code,
  category_name,
  category_description,
  is_total,
  is_unknown,
  case
    when is_total then 100
    when is_unknown then 0
    else 50
  end as default_filter_priority,
  'generated'::text as metadata_origin,
  now() as generated_at
from {{ ref('stg_gold_bouwen_wonen_categories') }}
