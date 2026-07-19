select *
from {{ ref('semantic_dataset_contract') }}
where dataset_code = '85035NED'
  and not (
    default_measure_name = 'Beginstand woningvoorraad'
    and default_breakdown_dimension = 'Woningtype'
    and default_filter_dimension = 'Woningkenmerk'
    and default_filter_value = 'Totaal woningen'
    and 'category_breakdown' = any(supported_query_shapes)
  )
