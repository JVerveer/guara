{{ config(
  materialized='incremental',
  unique_key=['dataset_code', 'dimension_code'],
  on_schema_change='sync_all_columns',
  pre_hook=delete_dataset_scope()
) }}

select
  dataset_key,
  dataset_code,
  dimension_code,
  count(*)::integer as category_count,
  count(*) filter (where is_total)::integer as total_category_count,
  count(*) filter (where is_unknown)::integer as unknown_category_count,
  array_agg(category_name order by is_total desc, category_name) filter (where is_total) as total_category_names,
  case
    when lower(dimension_code) in ('regios', 'regio', 'gebieden') then 'geography'
    when lower(dimension_code) = 'perioden' then 'time'
    else 'category'
  end as dimension_role,
  case
    when count(*) filter (where is_total) > 0 then true
    else false
  end as has_total_category,
  'generated'::text as metadata_origin,
  now() as generated_at
from {{ ref('stg_gold_bouwen_wonen_categories') }}
group by dataset_key, dataset_code, dimension_code
