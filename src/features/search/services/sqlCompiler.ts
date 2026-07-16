import type { AnalyticalQueryPlan, CompiledQuery } from "../types";

const FACT_TABLE = "gold_bouwen_wonen.fact_housing_observation";
const MAX_ROWS = 100;

const DIMENSION_COLUMNS: Record<string, { select: string; group: string; filter: string; label: string }> = {
  geography: { select: "geography_name", group: "geography_name, geography_code, geography_type", filter: "lower(geography_name)", label: "geography_name" },
  time: { select: "calendar_year", group: "calendar_year", filter: "calendar_year", label: "calendar_year" },
  dataset: { select: "dataset_code", group: "dataset_code", filter: "dataset_code", label: "dataset_code" },
  status: { select: "status_code", group: "status_code", filter: "status_code", label: "status_code" },
};

function metricParameter(metricId: string): { sql: string; parameters: unknown[] } {
  if (/^\d+$/.test(metricId)) return { sql: "measure_key = $1::bigint", parameters: [metricId] };
  return {
    sql: "measure_key = (select measure_key from semantic.metric where metric_code = $1 and is_enabled limit 1)",
    parameters: [metricId],
  };
}

function periodPredicates(plan: AnalyticalQueryPlan, params: unknown[]): string[] {
  const predicates: string[] = [];
  if (plan.timeRange?.periods?.length) {
    params.push(plan.timeRange.periods.map(Number));
    predicates.push(`calendar_year = any($${params.length}::integer[])`);
  }
  if (plan.timeRange?.startPeriod) {
    params.push(Number(plan.timeRange.startPeriod));
    predicates.push(`calendar_year >= $${params.length}::integer`);
  }
  if (plan.timeRange?.endPeriod) {
    params.push(Number(plan.timeRange.endPeriod));
    predicates.push(`calendar_year <= $${params.length}::integer`);
  }
  return predicates;
}

function filterPredicates(plan: AnalyticalQueryPlan, params: unknown[]): string[] {
  const predicates: string[] = [];
  for (const filter of plan.filters) {
    const dimension = DIMENSION_COLUMNS[filter.dimensionId];
    if (!dimension) continue;
    const values = filter.values;
    if (filter.dimensionId === "geography") {
      params.push(values.map((value) => String(value).toLowerCase()));
      predicates.push(`${dimension.filter} = any($${params.length}::text[])`);
    } else if (filter.operator === "eq") {
      params.push(values[0]);
      predicates.push(`${dimension.filter} = $${params.length}`);
    } else if (filter.operator === "in") {
      params.push(values);
      predicates.push(`${dimension.filter} = any($${params.length}::text[])`);
    }
  }
  return predicates;
}

function baseWhere(plan: AnalyticalQueryPlan, params: unknown[]): string {
  const metric = metricParameter(plan.metricId);
  params.push(...metric.parameters);
  const predicates = [
    metric.sql,
    plan.includeMissing ? "true" : "is_missing = false",
    "is_suppressed = false",
    "observation_value is not null",
    ...periodPredicates(plan, params),
    ...filterPredicates(plan, params),
  ];
  return predicates.join("\n  and ");
}

export function compileAnalyticalQuery(plan: AnalyticalQueryPlan): CompiledQuery {
  const params: unknown[] = [];
  const limit = Math.max(1, Math.min(plan.limit ?? 20, MAX_ROWS));
  const where = baseWhere(plan, params);
  const groupDimension = plan.groupBy[0]?.dimensionId ?? (plan.intent === "trend" ? "time" : undefined);
  const dimension = groupDimension ? DIMENSION_COLUMNS[groupDimension] : undefined;
  const aggregation = "sum(observation_value)";

  let sql: string;
  let expectedColumns: CompiledQuery["expectedColumns"];
  const selectedDimensions: string[] = groupDimension ? [groupDimension] : [];

  if (plan.intent === "lookup") {
    sql = `
      select geography_name, calendar_year, ${aggregation} as value
      from ${FACT_TABLE}
      where ${where}
      group by geography_name, calendar_year
      order by calendar_year desc nulls last, geography_name asc
      limit ${limit}
    `;
    expectedColumns = [
      { name: "geography_name", type: "text" },
      { name: "calendar_year", type: "number" },
      { name: "value", type: "number" },
    ];
  } else if (plan.intent === "absolute_change" || plan.intent === "percentage_change") {
    const base = plan.comparison?.basePeriod;
    const comparison = plan.comparison?.comparisonPeriod;
    params.push(Number(base), Number(comparison));
    const baseParam = params.length - 1;
    const comparisonParam = params.length;
    sql = `
      with yearly as (
        select geography_name, calendar_year, ${aggregation} as value
        from ${FACT_TABLE}
        where ${where}
          and calendar_year in ($${baseParam}::integer, $${comparisonParam}::integer)
        group by geography_name, calendar_year
      ),
      pivoted as (
        select
          geography_name,
          max(value) filter (where calendar_year = $${baseParam}::integer) as base_value,
          max(value) filter (where calendar_year = $${comparisonParam}::integer) as comparison_value
        from yearly
        group by geography_name
      )
      select
        geography_name,
        base_value,
        comparison_value,
        ${plan.intent === "percentage_change"
          ? "case when base_value = 0 then null else ((comparison_value - base_value) / base_value) * 100 end"
          : "comparison_value - base_value"} as value
      from pivoted
      where base_value is not null and comparison_value is not null
      order by value desc nulls last
      limit ${limit}
    `;
    expectedColumns = [
      { name: "geography_name", type: "text" },
      { name: "base_value", type: "number" },
      { name: "comparison_value", type: "number" },
      { name: "value", type: "number" },
    ];
  } else if (plan.intent === "share_of_total") {
    sql = `
      with grouped as (
        select geography_name, ${aggregation} as value
        from ${FACT_TABLE}
        where ${where}
        group by geography_name
      )
      select geography_name, value, case when sum(value) over () = 0 then null else value / sum(value) over () * 100 end as share_of_total
      from grouped
      order by share_of_total desc nulls last
      limit ${limit}
    `;
    expectedColumns = [
      { name: "geography_name", type: "text" },
      { name: "value", type: "number" },
      { name: "share_of_total", type: "number" },
    ];
  } else {
    const groupBy = dimension?.group ?? "geography_name, geography_code, geography_type";
    const label = dimension?.label ?? "geography_name";
    sql = `
      select ${groupBy}, ${aggregation} as value
      from ${FACT_TABLE}
      where ${where}
      group by ${groupBy}
      order by value ${plan.orderBy?.[0]?.direction === "asc" ? "asc" : "desc"} nulls last
      limit ${limit}
    `;
    expectedColumns = [
      { name: label, type: groupDimension === "time" ? "number" : "text" },
      { name: "value", type: "number" },
    ];
  }

  return {
    sql: sql.trim(),
    parameters: params,
    selectedMetricId: plan.metricId,
    selectedDimensions,
    expectedColumns,
    maxRows: limit,
    timeoutMs: 30_000,
  };
}
