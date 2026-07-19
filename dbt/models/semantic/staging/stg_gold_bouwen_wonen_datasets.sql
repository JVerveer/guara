select
  hd.housing_dataset_key,
  hd.dataset_key,
  hd.dataset_code,
  hd.dataset_title,
  hd.dataset_version,
  hd.source_system,
  hd.source_url,
  hd.source_organization,
  hd.last_updated_at_source,
  hd.domain_id,
  hd.domain_name,
  d.dataset_description,
  d.publication_date,
  d.loaded_at,
  d.is_active
from {{ source('gold_bouwen_wonen', 'dim_housing_dataset') }} hd
join {{ source('gold', 'dim_dataset') }} d
  on d.dataset_key = hd.dataset_key
where hd.domain_id = '{{ var("semantic_domain_id") }}'
{% if var("semantic_dataset_code", "") %}
  and hd.dataset_code = '{{ var("semantic_dataset_code") }}'
{% endif %}
