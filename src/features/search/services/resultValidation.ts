import type { CompiledQuery, QueryExecutionResult, ResultValidationResult } from "../types";

function isExpectedType(value: unknown, type: string): boolean {
  if (value == null) return true;
  if (type === "number") return typeof value === "number" || (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value)));
  if (type === "text") return typeof value === "string";
  return true;
}

export function validateQueryResult(compiled: CompiledQuery, result: QueryExecutionResult): ResultValidationResult {
  const warnings = [...result.warnings];
  const errors: ResultValidationResult["errors"] = [];

  if (result.rowCount === 0) {
    warnings.push({ type: "empty_result", severity: "warning", message: "The validated query returned no rows." });
  }

  const first = result.rows[0];
  if (first) {
    for (const column of compiled.expectedColumns) {
      if (!(column.name in first)) {
        errors.push({ code: "expected_column_missing", field: column.name, message: `Expected column ${column.name} is missing.` });
      }
    }

    for (const row of result.rows) {
      for (const column of compiled.expectedColumns) {
        if (!isExpectedType(row[column.name], column.type)) {
          errors.push({ code: "unexpected_column_type", field: column.name, message: `Column ${column.name} has an unexpected type.` });
          break;
        }
      }
    }
  }

  const duplicateKeys = new Set<string>();
  const seenKeys = new Set<string>();
  for (const row of result.rows) {
    const key = compiled.selectedDimensions.map((dimension) => String(row[dimension] ?? row[`${dimension}_name`] ?? "")).join("|");
    if (!key) continue;
    if (seenKeys.has(key)) duplicateKeys.add(key);
    seenKeys.add(key);
  }
  if (duplicateKeys.size) {
    warnings.push({ type: "coverage_limitation", severity: "warning", message: "Duplicate grouped rows were detected." });
  }

  return {
    status: errors.length ? "invalid" : warnings.length ? "warning" : "valid",
    warnings,
    errors,
  };
}
