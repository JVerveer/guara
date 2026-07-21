select
  f.housing_observation_key,
  f.dataset_key,
  f.dataset_code,
  f.measure_key,
  f.housing_indicator_key,
  f.date_key,
  f.calendar_year,
  f.period_code,
  f.period_type,
  f.geography_key,
  f.geography_code,
  f.geography_name,
  f.geography_type,
  f.observation_value,
  f.is_missing,
  f.is_suppressed,
  f.category_combination_hash
from {{ source('gold_bouwen_wonen', 'fact_housing_observation') }} f
join {{ ref('stg_gold_bouwen_wonen_datasets') }} d
  on d.dataset_key = f.dataset_key
{% if var("semantic_dataset_code", "") %}
where (f.dataset_code = '{{ var("semantic_dataset_code") }}' or f.source_dataset_id = '{{ var("semantic_dataset_code") }}')
{% endif %}
