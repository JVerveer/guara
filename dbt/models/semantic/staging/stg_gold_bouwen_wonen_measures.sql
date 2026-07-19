select
  hi.housing_indicator_key,
  hi.measure_key,
  hi.dataset_key,
  d.dataset_code,
  hi.measure_code,
  hi.indicator_name as measure_name,
  hi.indicator_description as measure_description,
  hi.topic,
  hi.subtopic,
  hi.unit_key,
  hi.unit_code,
  hi.unit_name,
  u.unit_category,
  u.scale_factor,
  u.is_percentage,
  u.is_index,
  hi.default_aggregation,
  hi.is_additive,
  hi.is_non_additive,
  hi.value_type,
  hi.modelling_status
from {{ source('gold_bouwen_wonen', 'dim_housing_indicator') }} hi
join {{ source('gold', 'dim_dataset') }} d
  on d.dataset_key = hi.dataset_key
left join {{ source('gold', 'dim_unit') }} u
  on u.unit_key = hi.unit_key
where d.source_system = '{{ var("semantic_source_system") }}'
{% if var("semantic_dataset_code", "") %}
  and d.dataset_code = '{{ var("semantic_dataset_code") }}'
{% endif %}
