export interface SearchLogEvent {
  event: string;
  requestId?: string;
  userId?: string | null;
  investigationId?: string | null;
  intent?: string;
  resolvedMetric?: string | null;
  queryPlanVersion?: string;
  searchDurationMs?: number;
  embeddingDurationMs?: number;
  llmDurationMs?: number;
  sqlExecutionDurationMs?: number;
  resultRowCount?: number;
  warningCount?: number;
  failureCategory?: string;
}

export function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function logSearchEvent(event: SearchLogEvent): void {
  const safeEvent = Object.fromEntries(
    Object.entries(event).filter(([, value]) => value !== undefined)
  );
  console.info(JSON.stringify({ level: "info", component: "guara-search", ...safeEvent }));
}

export function logSearchFailure(event: SearchLogEvent): void {
  const safeEvent = Object.fromEntries(
    Object.entries(event).filter(([, value]) => value !== undefined)
  );
  console.warn(JSON.stringify({ level: "warn", component: "guara-search", ...safeEvent }));
}
