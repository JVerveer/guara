import type { AnalyticalQueryPlan } from "../types";

const INTENTS = new Set(["lookup", "ranking", "trend", "comparison", "absolute_change", "percentage_change", "share_of_total"]);
const OPERATORS = new Set(["eq", "neq", "in", "not_in", "gt", "gte", "lt", "lte", "between"]);
const MAX_LIMIT = 100;

export function validateAnalyticalQueryPlan(plan: unknown): { ok: true; plan: AnalyticalQueryPlan } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const value = plan as Partial<AnalyticalQueryPlan>;

  if (!value || typeof value !== "object") errors.push("Plan must be an object.");
  if (value.version !== "1") errors.push("Plan version must be \"1\".");
  if (!value.intent || !INTENTS.has(value.intent)) errors.push("Unsupported analytical intent.");
  if (!value.metricId || typeof value.metricId !== "string") errors.push("metricId is required.");
  if (!Array.isArray(value.groupBy)) errors.push("groupBy must be an array.");
  if (!Array.isArray(value.filters)) errors.push("filters must be an array.");

  for (const [index, filter] of (value.filters ?? []).entries()) {
    if (!filter.dimensionId || typeof filter.dimensionId !== "string") errors.push(`filters[${index}].dimensionId is required.`);
    if (!OPERATORS.has(filter.operator)) errors.push(`filters[${index}].operator is not allowed.`);
    if (!Array.isArray(filter.values)) errors.push(`filters[${index}].values must be an array.`);
  }

  if (value.limit != null && (!Number.isInteger(value.limit) || value.limit < 1 || value.limit > MAX_LIMIT)) {
    errors.push(`limit must be between 1 and ${MAX_LIMIT}.`);
  }

  if (value.orderBy) {
    for (const [index, order] of value.orderBy.entries()) {
      if (!order.field || typeof order.field !== "string") errors.push(`orderBy[${index}].field is required.`);
      if (!["asc", "desc"].includes(order.direction)) errors.push(`orderBy[${index}].direction must be asc or desc.`);
      if (/[.;\s]/.test(order.field)) errors.push(`orderBy[${index}].field must be a logical field, not SQL.`);
    }
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    plan: {
      version: "1",
      intent: value.intent as AnalyticalQueryPlan["intent"],
      metricId: value.metricId!,
      groupBy: value.groupBy ?? [],
      filters: value.filters ?? [],
      timeRange: value.timeRange,
      comparison: value.comparison,
      orderBy: value.orderBy,
      limit: Math.min(value.limit ?? 20, MAX_LIMIT),
      includeMissing: value.includeMissing ?? false,
    },
  };
}
