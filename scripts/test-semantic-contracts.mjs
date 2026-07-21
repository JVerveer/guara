#!/usr/bin/env node
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

async function contractDiagnostics(client, { domain, metricCode }) {
  const { rows } = await client.query(`
    with executable_contracts as (
      select *
      from semantic.metric_contract
      where is_active
        and execution_status = 'enabled'
        and contract_status in ('reviewed', 'curated')
        and ($1::text is null or domain_id = $1)
        and ($2::text is null or metric_code = $2)
    ),
    diagnostics as (
      select
        mc.metric_code,
        mc.label,
        mc.dataset_codes,
        mc.measure_key,
        mc.unit_code,
        mc.aggregation,
        mc.valid_grains,
        mc.default_grain,
        mc.category_filters,
        exists (
          select 1
          from semantic.contract_availability a
          where a.metric_code = mc.metric_code
            and a.measure_key = mc.measure_key
            and a.row_count > 0
        ) as has_availability,
        coalesce((
          select jsonb_agg(filter_check)
          from (
            select
              required_filter.key as dimension_code,
              required_filter.value as category_value,
              exists (
                select 1
                from semantic.dimension_contract dc
                where dc.is_active
                  and dc.domain_id = mc.domain_id
                  and (dc.dataset_code is null or dc.dataset_code = any(mc.dataset_codes))
                  and lower(dc.dimension_code) = lower(required_filter.key)
                  and (
                    dc.valid_values @> jsonb_build_array(jsonb_build_object('category_name', required_filter.value))
                    or dc.valid_values @> jsonb_build_array(jsonb_build_object('category_code', required_filter.value))
                  )
              ) as filter_value_valid
            from (
              select key, value
              from jsonb_each_text(coalesce(mc.category_filters, '{}'::jsonb))
              union all
              select binding_filter.key, binding_filter.value
              from semantic.concept_metric_binding b
              cross join lateral jsonb_each_text(coalesce(b.category_filters, '{}'::jsonb)) binding_filter(key, value)
              where b.is_active
                and b.metric_code = mc.metric_code
            ) required_filter
          ) filter_check
        ), '[]'::jsonb) as filter_checks
      from executable_contracts mc
    )
    select
      *,
      array_remove(array[
        case when coalesce(array_length(dataset_codes, 1), 0) = 0 then 'missing_dataset_codes' end,
        case when measure_key is null then 'missing_measure_key' end,
        case when unit_code is null then 'missing_unit_code' end,
        case when aggregation is null or aggregation = 'none' then 'missing_safe_aggregation' end,
        case when coalesce(array_length(valid_grains, 1), 0) = 0 then 'missing_valid_grains' end,
        case when default_grain is null then 'missing_default_grain' end,
        case when not has_availability then 'missing_contract_availability' end,
        case when exists (
          select 1
          from jsonb_to_recordset(filter_checks) as check_row(dimension_code text, category_value text, filter_value_valid boolean)
          where not filter_value_valid
        ) then 'invalid_category_filter' end
      ], null) as errors
    from diagnostics
    order by metric_code
  `, [domain, metricCode]);
  return rows;
}

async function goldenQuestionDiagnostics(client, { domain, metricCode }) {
  const { rows } = await client.query(`
    with questions as (
      select g.*
      from semantic.golden_question g
      where g.is_active
        and ($1::text is null or g.domain_id = $1)
        and ($2::text is null or g.expected_metric_code = $2)
    ),
    checks as (
      select
        q.question,
        q.expected_metric_code,
        q.expected_dataset_code,
        q.expected_grain,
        q.expected_category_filters,
        mc.metric_code,
        mc.dataset_codes,
        mc.valid_grains,
        mc.execution_status,
        mc.contract_status,
        exists (
          select 1
          from semantic.contract_availability a
          where a.metric_code = q.expected_metric_code
            and ($2::text is null or a.metric_code = $2)
            and (q.expected_dataset_code is null or a.dataset_code = q.expected_dataset_code)
            and (q.expected_geography_type is null or a.geography_type = q.expected_geography_type)
            and (q.expected_year is null or a.calendar_year = q.expected_year)
            and a.row_count > 0
        ) as expected_availability_exists
      from questions q
      left join semantic.metric_contract mc
        on mc.metric_code = q.expected_metric_code
       and mc.is_active
    )
    select *,
      array_remove(array[
        case when expected_metric_code is null then 'missing_expected_metric_code' end,
        case when metric_code is null then 'expected_metric_contract_not_found' end,
        case when metric_code is not null and execution_status <> 'enabled' then 'expected_metric_not_executable' end,
        case when metric_code is not null and contract_status not in ('reviewed', 'curated') then 'expected_metric_not_reviewed' end,
        case when expected_dataset_code is not null and not (expected_dataset_code = any(coalesce(dataset_codes, '{}'))) then 'expected_dataset_not_in_contract' end,
        case when expected_grain is not null and not (expected_grain = any(coalesce(valid_grains, '{}'))) then 'expected_grain_not_in_contract' end,
        case when not expected_availability_exists then 'missing_expected_availability' end
      ], null) as errors
    from checks
    order by question
  `, [domain, metricCode]);
  return rows;
}

async function main() {
  loadLocalEnv();
  const client = createPostgresClient({
    applicationName: "guara-semantic-contract-test",
    statementTimeoutMs: 300000,
    queryTimeoutMs: 300000,
  });
  await client.connect();
  try {
    const domain = argValue("domain", "bouwen-en-wonen");
    const metricCode = argValue("metric-code", null);
    const rows = await contractDiagnostics(client, { domain, metricCode });
    const goldenRows = await goldenQuestionDiagnostics(client, { domain, metricCode });
    const failing = rows.filter((row) => Array.isArray(row.errors) && row.errors.length > 0);
    const failingGolden = goldenRows.filter((row) => Array.isArray(row.errors) && row.errors.length > 0);

    console.log(`Checked ${rows.length} executable semantic contract(s).`);
    console.log(`Checked ${goldenRows.length} semantic golden question(s).`);
    if (failing.length) {
      console.table(failing.map((row) => ({
        metric_code: row.metric_code,
        label: row.label,
        errors: row.errors.join(", "),
      })));
      process.exitCode = 1;
      return;
    }
    if (failingGolden.length) {
      console.table(failingGolden.map((row) => ({
        question: row.question,
        expected_metric_code: row.expected_metric_code,
        errors: row.errors.join(", "),
      })));
      process.exitCode = 1;
      return;
    }

    console.log("All executable semantic contracts passed structural checks.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(explainPostgresConnectionError(error));
  process.exitCode = 1;
});
