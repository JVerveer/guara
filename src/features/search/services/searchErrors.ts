export type SearchErrorCode =
  | "SEARCH_NO_RESULTS"
  | "METRIC_NOT_FOUND"
  | "AMBIGUOUS_METRIC"
  | "DIMENSION_NOT_ALLOWED"
  | "INVALID_TIME_RANGE"
  | "UNSUPPORTED_CALCULATION"
  | "QUERY_TOO_EXPENSIVE"
  | "QUERY_TIMEOUT"
  | "EMPTY_RESULT"
  | "INCOMPARABLE_PERIODS"
  | "LLM_PROVIDER_UNAVAILABLE"
  | "EMBEDDING_PROVIDER_UNAVAILABLE"
  | "QUERY_EXECUTION_FAILED"
  | "QUERY_PLAN_INVALID"
  | "SUPABASE_NOT_CONFIGURED";

export interface StructuredSearchError {
  code: SearchErrorCode;
  message: string;
  field?: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export function structuredSearchError(
  code: SearchErrorCode,
  message: string,
  options: { field?: string; retryable?: boolean; details?: Record<string, unknown> } = {}
): StructuredSearchError {
  return {
    code,
    message,
    field: options.field,
    retryable: options.retryable ?? false,
    details: options.details,
  };
}

export function isTimeoutError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /timeout|statement timeout|canceling statement/i.test(message);
}
