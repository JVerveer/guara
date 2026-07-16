import type { CompiledQuery, QueryExecutionResult, StructuredError } from "../types";
import { isTimeoutError } from "./searchErrors";

export interface CompiledQueryRunner {
  run(sql: string, parameters: unknown[], options: { timeoutMs: number; maxRows: number }): Promise<Array<Record<string, unknown>>>;
}

export async function executeCompiledQuery(
  compiled: CompiledQuery,
  runner: CompiledQueryRunner
): Promise<{ ok: true; result: QueryExecutionResult } | { ok: false; error: StructuredError }> {
  const started = performance.now();
  try {
    const rows = await runner.run(compiled.sql, compiled.parameters, {
      timeoutMs: compiled.timeoutMs,
      maxRows: compiled.maxRows,
    });
    const limitedRows = rows.slice(0, compiled.maxRows);
    return {
      ok: true,
      result: {
        rows: limitedRows,
        rowCount: limitedRows.length,
        durationMs: Math.round(performance.now() - started),
        warnings: rows.length > compiled.maxRows
          ? [{ type: "security_limit", severity: "warning", message: `Result was limited to ${compiled.maxRows} rows.` }]
          : [],
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: isTimeoutError(error) ? "QUERY_TIMEOUT" : "QUERY_EXECUTION_FAILED",
        message: isTimeoutError(error)
          ? "The analytical query timed out before it could finish safely."
          : "The analytical query could not be executed safely.",
      },
    };
  }
}
