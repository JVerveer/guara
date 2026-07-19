select
  d.dataset_code,
  c.dataset_key,
  c.category_key,
  c.dimension_code,
  c.category_code,
  c.category_name,
  c.category_description,
  c.parent_category_key,
  c.category_level,
  c.sort_order,
  c.is_total,
  c.is_unknown
from {{ source('gold', 'dim_category') }} c
join {{ source('gold', 'dim_dataset') }} d
  on d.dataset_key = c.dataset_key
join {{ ref('stg_gold_bouwen_wonen_datasets') }} hd
  on hd.dataset_key = d.dataset_key
