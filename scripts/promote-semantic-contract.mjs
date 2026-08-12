#!/usr/bin/env node
import { createPostgresClient, explainPostgresConnectionError, loadLocalEnv } from "./lib/runtime.mjs";

const allowedStatuses = new Set(["generated", "profiled", "reviewed", "curated", "deprecated"]);

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function diagnostics(client, metricCode) {
  const { rows } = await client.query(`
    with selected as (
      select *
      from semantic.metric_contract
      where metric_code = $1
        and is_active
      limit 1
    ),
    checks as (
      select
        mc.metric_code,
        mc.contract_status,
        mc.execution_status,
        exists (
          select 1
          from semantic.contract_availability a
          where a.metric_code = mc.metric_code
            and a.measure_key = mc.measure_key
            and a.row_count > 0
        ) as has_availability,
        coalesce((
          select bool_and(filter_value_valid)
          from (
            select exists (
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
          ) filter_checks
        ), true) as filters_valid,
        exists (
          select 1
          from semantic.golden_question g
          where g.is_active
            and (
              g.expected_metric_code = mc.metric_code
              or g.expected_dataset_code = any(mc.dataset_codes)
              or lower(g.expected_measure_label) = lower(mc.label)
            )
        ) as has_golden_questions,
        coalesce(array_length(mc.dataset_codes, 1), 0) > 0 as has_dataset,
        mc.measure_key is not null as has_measure,
        mc.unit_code is not null as has_unit,
        coalesce(mc.aggregation, 'none') <> 'none' as has_safe_aggregation,
        coalesce(array_length(mc.valid_grains, 1), 0) > 0 as has_grains,
        mc.default_grain is not null as has_default_grain
      from selected mc
    )
    select *,
      array_remove(array[
        case when not has_dataset then 'missing_dataset_codes' end,
        case when not has_measure then 'missing_measure_key' end,
        case when not has_unit then 'missing_unit_code' end,
        case when not has_safe_aggregation then 'missing_safe_aggregation' end,
        case when not has_grains then 'missing_valid_grains' end,
        case when not has_default_grain then 'missing_default_grain' end,
        case when not has_availability then 'missing_contract_availability' end,
        case when not filters_valid then 'invalid_category_filter' end,
        case when not has_golden_questions then 'missing_golden_questions' end
      ], null) as errors
    from checks
  `, [metricCode]);
  return rows[0] ?? null;
}

async function workbenchDiagnostics(client, metricCode) {
  const { rows } = await client.query(
    `
      select diagnostic_code, severity, message, is_blocking, metadata
      from semantic.metric_contract_diagnostic
      where metric_code = $1
      order by is_blocking desc, severity, diagnostic_code
    `,
    [metricCode]
  );
  return rows;
}

async function reviewRecord(client, metricCode) {
  const { rows } = await client.query(
    `
      select *
      from semantic.metric_contract_review
      where metric_code = $1
      limit 1
    `,
    [metricCode]
  );
  return rows[0] ?? null;
}

async function currentContract(client, metricCode) {
  const { rows } = await client.query(
    `
      select *
      from semantic.metric_contract
      where metric_code = $1
      limit 1
    `,
    [metricCode]
  );
  return rows[0] ?? null;
}

async function promote(client, metricCode, toStatus, force, reviewer, reason) {
  const before = await currentContract(client, metricCode);
  if (!before) throw new Error(`Metric contract not found: ${metricCode}`);
  const check = await diagnostics(client, metricCode);
  const review = await reviewRecord(client, metricCode);
  const workbenchChecks = await workbenchDiagnostics(client, metricCode);
  const blockingWorkbenchChecks = workbenchChecks.filter((item) => item.is_blocking);
  const errors = [...(check?.errors ?? []), ...blockingWorkbenchChecks.map((item) => item.diagnostic_code)];
  if (!force && ["reviewed", "curated"].includes(toStatus) && errors.length) {
    throw new Error(`Cannot promote ${metricCode} to ${toStatus}. Failing checks: ${Array.from(new Set(errors)).join(", ")}`);
  }
  const executionStatus = ["reviewed", "curated"].includes(toStatus) ? "enabled" : "disabled";
  const qualityStatus = toStatus === "curated" ? "curated" : toStatus === "reviewed" ? "reviewed" : toStatus;
  await client.query("begin");
  try {
    const { rows } = await client.query(
      `
        update semantic.metric_contract
        set
          contract_status = $2,
          execution_status = $3,
          semantic_quality_status = $4,
          metadata_origin = case when $2 in ('reviewed', 'curated') then 'curated' else metadata_origin end,
          updated_at = now()
        where metric_code = $1
        returning *
      `,
      [metricCode, toStatus, executionStatus, qualityStatus]
    );
    const after = rows[0];

    if (review) {
      await client.query(
        `
          update semantic.metric_contract_review
          set
            review_status = case when $2 in ('reviewed', 'curated') then 'promoted' else $2 end,
            reviewed_by = coalesce($3, reviewed_by),
            reviewed_at = case when $2 in ('reviewed', 'curated') then now() else reviewed_at end,
            promoted_at = case when $2 in ('reviewed', 'curated') then now() else promoted_at end,
            rejection_reason = case when $2 = 'deprecated' then $4 else rejection_reason end,
            updated_at = now()
          where review_id = $1
        `,
        [review.review_id, toStatus, reviewer, reason]
      );
    }

    await client.query(
      `
        insert into semantic.metric_contract_promotion_event (
          metric_code, review_id, from_status, to_status, from_execution_status, to_execution_status,
          promoted_by, event_reason, contract_snapshot, diagnostics_snapshot
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
      `,
      [
        metricCode,
        review?.review_id ?? null,
        before.contract_status,
        toStatus,
        before.execution_status,
        executionStatus,
        reviewer,
        reason,
        JSON.stringify(after),
        JSON.stringify(workbenchChecks),
      ]
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
  return { executionStatus, qualityStatus, warnings: Array.from(new Set(errors)) };
}

async function main() {
  loadLocalEnv();
  const metricCode = argValue("metric-code");
  const toStatus = argValue("to");
  const reviewer = argValue("reviewed-by") || argValue("promoted-by") || null;
  const reason = argValue("reason") || null;
  const force = hasFlag("force");
  if (!metricCode || !toStatus || !allowedStatuses.has(toStatus)) {
    throw new Error("Usage: npm run promote:semantic:contract -- --metric-code <code> --to reviewed|curated|deprecated [--reviewed-by <name>] [--reason <text>] [--force]");
  }

  const client = createPostgresClient({
    applicationName: "guara-semantic-contract-promotion",
    statementTimeoutMs: 300000,
    queryTimeoutMs: 300000,
  });
  await client.connect();
  try {
    const result = await promote(client, metricCode, toStatus, force, reviewer, reason);
    await client.query("notify pgrst, 'reload schema'");
    console.log(`Promoted ${metricCode} to ${toStatus} (${result.executionStatus}).`);
    if (force && result.warnings.length) console.log(`Forced despite checks: ${result.warnings.join(", ")}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(explainPostgresConnectionError(error));
  process.exitCode = 1;
});
