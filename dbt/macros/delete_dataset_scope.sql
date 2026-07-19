{% macro delete_dataset_scope() -%}
  {%- if var("semantic_dataset_code", "") -%}
    delete from {{ this }} where dataset_code = '{{ var("semantic_dataset_code") }}'
  {%- else -%}
    select 1
  {%- endif -%}
{%- endmacro %}
