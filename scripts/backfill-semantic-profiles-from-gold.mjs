#!/usr/bin/env node
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

const MARTS = {
  "bouwen-en-wonen": {
    datasetDim: "gold_bouwen_wonen.dim_housing_dataset",
    indicatorDim: "gold_bouwen_wonen.dim_housing_indicator",
  },
  "inkomen-en-bestedingen": {
    datasetDim: "gold_inkomen_bestedingen.dim_income_dataset",
    indicatorDim: "gold_inkomen_bestedingen.dim_income_indicator",
  },
};

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function sqlName(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(value)) throw new Error(`Unsafe SQL name: ${value}`);
  return value.split(".").map((part) => `"${part}"`).join(".");
}

async function domainDatasetCodes(client, mart) {
  const { rows } = await client.query(`select dataset_code from ${sqlName(mart.datasetDim)}`);
  return rows.map((row) => row.dataset_code);
}

async function refreshDomain(client, domainId, mart) {
  const datasetDim = sqlName(mart.datasetDim);
  const indicatorDim = sqlName(mart.indicatorDim);
  const datasetCodes = await domainDatasetCodes(client, mart);
  if (!datasetCodes.length) return { datasets: 0, measures: 0, dimensions: 0, categories: 0 };

  await client.query(`delete from semantic.semantic_dataset_contract where dataset_code = any($1::text[])`, [datasetCodes]);
  await client.query(`delete from semantic.semantic_measure_profile where dataset_code = any($1::text[])`, [datasetCodes]);
  await client.query(`delete from semantic.semantic_dimension_profile where dataset_code = any($1::text[])`, [datasetCodes]);
  await client.query(`delete from semantic.semantic_category_profile where dataset_code = any($1::text[])`, [datasetCodes]);

  const categoryInsert = await client.query(`
    insert into semantic.semantic_category_profile (
      dataset_key, dataset_code, dimension_code, category_key, category_code, category_name,
      category_description, is_total, is_unknown, default_filter_priority, metadata_origin, generated_at
    )
    select
      c.dataset_key,
      d.dataset_code,
      c.dimension_code,
      c.category_key,
      c.category_code,
      c.category_name,
      c.category_description,
      c.is_total,
      c.is_unknown,
      case when c.is_total then 100 when c.is_unknown then 0 else 50 end,
      'generated',
      now()
    from gold.dim_category c
    join ${datasetDim} d on d.dataset_key = c.dataset_key
  `);

  const dimensionInsert = await client.query(`
    insert into semantic.semantic_dimension_profile (
      dataset_key, dataset_code, dimension_code, category_count, total_category_count,
      unknown_category_count, total_category_names, dimension_role, has_total_category,
      metadata_origin, generated_at
    )
    select
      c.dataset_key,
      d.dataset_code,
      c.dimension_code,
      count(*)::integer,
      count(*) filter (where c.is_total)::integer,
      count(*) filter (where c.is_unknown)::integer,
      array_agg(c.category_name order by c.is_total desc, c.category_name) filter (where c.is_total),
      case
        when lower(c.dimension_code) in ('regios', 'regio', 'gebieden') then 'geography'
        when lower(c.dimension_code) = 'perioden' then 'time'
        else 'category'
      end,
      count(*) filter (where c.is_total) > 0,
      'generated',
      now()
    from gold.dim_category c
    join ${datasetDim} d on d.dataset_key = c.dataset_key
    group by c.dataset_key, d.dataset_code, c.dimension_code
  `);

  const measureInsert = await client.query(`
    insert into semantic.semantic_measure_profile (
      dataset_key, dataset_code, measure_key, measure_code, measure_name, measure_description,
      topic, subtopic, unit_key, unit_code, unit_name, unit_category, scale_factor,
      default_aggregation, is_additive, is_non_additive, value_type, fact_row_count,
      populated_fact_row_count, min_year, max_year, geography_types, period_types,
      geography_count, period_count, min_value, max_value, suggested_aggregation,
      can_enable_metric, profile_depth, metadata_origin, generated_at
    )
    select
      i.dataset_key,
      d.dataset_code,
      i.measure_key,
      i.measure_code,
      i.indicator_name,
      i.indicator_description,
      i.topic,
      i.subtopic,
      i.unit_key,
      i.unit_code,
      i.unit_name,
      u.unit_category,
      u.scale_factor,
      i.default_aggregation,
      i.is_additive,
      i.is_non_additive,
      i.value_type,
      coalesce(c.loaded_fact_rows, p.loaded_fact_rows, 0),
      coalesce(c.populated_fact_rows, p.populated_fact_rows, 0),
      coalesce(c.min_year, p.min_year),
      coalesce(c.max_year, p.max_year),
      coalesce(c.geography_types, p.geography_types, '{}'::text[]),
      coalesce(c.period_types, array['year']::text[]),
      null::integer,
      null::integer,
      null::numeric,
      null::numeric,
      case
        when i.default_aggregation is not null and i.default_aggregation <> 'none' then i.default_aggregation
        when i.is_additive then 'sum'
        when i.is_non_additive then 'average'
        else 'none'
      end,
      coalesce(c.executable_candidate, false),
      case when coalesce(c.populated_fact_rows, p.populated_fact_rows, 0) > 0 then 'gold_profiled' else 'metadata_only' end,
      'generated',
      now()
    from ${indicatorDim} i
    join ${datasetDim} d on d.dataset_key = i.dataset_key
    left join gold.dim_unit u on u.unit_key = i.unit_key
    left join semantic.gold_measure_capability c
      on c.domain_id = $1
     and upper(c.dataset_code) = upper(d.dataset_code)
     and c.measure_key = i.measure_key
    left join semantic.workbench_measure_profile p
      on p.domain_id = $1
     and upper(p.dataset_code) = upper(d.dataset_code)
     and p.measure_key = i.measure_key
  `, [domainId]);

  const datasetInsert = await client.query(`
    with default_measure as (
      select distinct on (dataset_code)
        dataset_code,
        measure_key as default_measure_key,
        measure_name as default_measure_name,
        unit_code as default_unit_code
      from semantic.semantic_measure_profile
      where dataset_code = any($2::text[])
      order by
        dataset_code,
        case when populated_fact_row_count > 0 then 0 else 1 end,
        case
          when lower(measure_name) like '%totaal%' then 0
          when lower(measure_name) like '%gemiddeld%' then 1
          when unit_code = 'COUNT' then 2
          else 10
        end,
        populated_fact_row_count desc
    ),
    default_breakdown as (
      select distinct on (dataset_code)
        dataset_code,
        dimension_code as default_breakdown_dimension
      from semantic.semantic_dimension_profile
      where dataset_code = any($2::text[])
        and dimension_role = 'category'
        and category_count > 1
      order by
        dataset_code,
        case when lower(dimension_code) like '%type%' then 0 when total_category_count > 0 then 1 else 10 end,
        category_count desc
    ),
    default_filter as (
      select distinct on (dp.dataset_code)
        dp.dataset_code,
        dp.dimension_code as default_filter_dimension,
        dp.total_category_names[1] as default_filter_value
      from semantic.semantic_dimension_profile dp
      left join default_breakdown db on db.dataset_code = dp.dataset_code
      where dp.dataset_code = any($2::text[])
        and dp.total_category_count > 0
        and dp.dimension_code <> coalesce(db.default_breakdown_dimension, '')
      order by dp.dataset_code, dp.total_category_count desc, dp.dimension_code
    ),
    dimension_rollup as (
      select
        dataset_code,
        array_agg(dimension_code order by dimension_code) as dimension_codes
      from semantic.semantic_dimension_profile
      where dataset_code = any($2::text[])
      group by dataset_code
    ),
    capability_rollup as (
      select
        dataset_code,
        min(min_year) as min_year,
        max(max_year) as max_year,
        array_agg(distinct geography_type order by geography_type) filter (where geography_type is not null) as geography_types,
        array_agg(distinct period_type order by period_type) filter (where period_type is not null) as period_types
      from semantic.gold_measure_capability c
      cross join lateral unnest(coalesce(c.geography_types, '{}'::text[])) geography_type
      cross join lateral unnest(coalesce(c.period_types, array['year']::text[])) period_type
      where c.domain_id = $1
        and c.dataset_code = any($2::text[])
      group by dataset_code
    )
    insert into semantic.semantic_dataset_contract (
      dataset_key, dataset_code, dataset_title, domain_id, data_availability_status,
      profile_depth, default_measure_key, default_measure_name, default_unit_code,
      default_breakdown_dimension, default_filter_dimension, default_filter_value,
      geography_types, period_types, dimension_codes, min_year, max_year,
      supported_query_shapes, contract_status, metadata_origin, generated_at
    )
    select
      d.dataset_key,
      d.dataset_code,
      d.dataset_title,
      $1,
      case when coalesce(max(m.populated_fact_row_count), 0) > 0 then 'loaded' else 'not_loaded' end,
      case when coalesce(max(m.populated_fact_row_count), 0) > 0 then 'gold_profiled' else 'metadata_only' end,
      dm.default_measure_key,
      dm.default_measure_name,
      dm.default_unit_code,
      db.default_breakdown_dimension,
      df.default_filter_dimension,
      df.default_filter_value,
      coalesce(cr.geography_types, '{}'::text[]),
      coalesce(cr.period_types, array['year']::text[]),
      coalesce(dr.dimension_codes, '{}'::text[]),
      cr.min_year,
      cr.max_year,
      array_remove(array[
        'measure_lookup',
        case when db.default_breakdown_dimension is not null then 'category_breakdown' end,
        case when cardinality(coalesce(cr.geography_types, '{}'::text[])) > 0 then 'geography_comparison' end
      ], null),
      'generated',
      'generated',
      now()
    from ${datasetDim} d
    left join semantic.semantic_measure_profile m on m.dataset_code = d.dataset_code
    left join default_measure dm on dm.dataset_code = d.dataset_code
    left join default_breakdown db on db.dataset_code = d.dataset_code
    left join default_filter df on df.dataset_code = d.dataset_code
    left join dimension_rollup dr on dr.dataset_code = d.dataset_code
    left join capability_rollup cr on cr.dataset_code = d.dataset_code
    group by
      d.dataset_key, d.dataset_code, d.dataset_title, dm.default_measure_key,
      dm.default_measure_name, dm.default_unit_code, db.default_breakdown_dimension,
      df.default_filter_dimension, df.default_filter_value, dr.dimension_codes,
      cr.geography_types, cr.period_types, cr.min_year, cr.max_year
  `, [domainId, datasetCodes]);

  return {
    datasets: datasetInsert.rowCount ?? 0,
    measures: measureInsert.rowCount ?? 0,
    dimensions: dimensionInsert.rowCount ?? 0,
    categories: categoryInsert.rowCount ?? 0,
  };
}

async function main() {
  loadLocalEnv();
  const domain = argValue("domain", "");
  const selected = Object.entries(MARTS).filter(([domainId]) => !domain || domain === domainId);
  if (!selected.length) throw new Error(`Unknown domain: ${domain}`);

  const client = createPostgresClient({
    applicationName: "guara-semantic-profile-backfill",
    statementTimeoutMs: 600000,
    queryTimeoutMs: 600000,
  });

  await client.connect();
  try {
    for (const [domainId, mart] of selected) {
      const result = await refreshDomain(client, domainId, mart);
      console.log(`Backfilled semantic profiles for ${domainId}: ${JSON.stringify(result)}`);
    }
    await client.query("notify pgrst, 'reload schema'");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(explainPostgresConnectionError(error));
  process.exitCode = 1;
});
