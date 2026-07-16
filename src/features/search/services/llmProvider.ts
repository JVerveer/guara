import { extractConcepts } from "./conceptExtraction";
import { classifySearchRequest } from "./intentClassifier";
import type {
  AnalyticalQueryPlan,
  ExtractedConcepts,
  GeneratedAnswer,
  IntentClassification,
  QueryExecutionResult,
  QueryWarning,
  RankedSemanticCandidate,
} from "../types";

export interface LlmStructuredContext {
  question: string;
  rankedCandidates: RankedSemanticCandidate[];
  approvedDimensions: Array<{ id: string; label: string; type: string }>;
  approvedCalculations: Array<{ code: string; label: string }>;
  caveats: QueryWarning[];
  queryExamples: Array<{ question: string; expectedIntent: string }>;
}

export interface LlmProvider {
  providerName: string;
  classifyIntent(context: Pick<LlmStructuredContext, "question" | "rankedCandidates">): Promise<IntentClassification>;
  extractConcepts(context: Pick<LlmStructuredContext, "question" | "rankedCandidates">): Promise<ExtractedConcepts>;
  createQueryPlan(context: LlmStructuredContext): Promise<AnalyticalQueryPlan | null>;
  generateAnswer(context: {
    question: string;
    resolvedInterpretation: AnalyticalQueryPlan;
    result: QueryExecutionResult;
    metricDefinition?: string;
    unit?: string;
    datasetMetadata?: Record<string, unknown>;
    caveats: QueryWarning[];
    validationWarnings: QueryWarning[];
  }): Promise<GeneratedAnswer>;
}

export class DeterministicFallbackLlmProvider implements LlmProvider {
  providerName = "deterministic-fallback";

  async classifyIntent(context: Pick<LlmStructuredContext, "question">): Promise<IntentClassification> {
    return classifySearchRequest(context.question);
  }

  async extractConcepts(context: Pick<LlmStructuredContext, "question">): Promise<ExtractedConcepts> {
    return extractConcepts(context.question);
  }

  async createQueryPlan(context: LlmStructuredContext): Promise<AnalyticalQueryPlan | null> {
    const metric = context.rankedCandidates.find((candidate) => candidate.objectType === "metric");
    const concepts = extractConcepts(context.question);
    const calculation = concepts.calculation ?? "lookup";
    if (!metric) return null;

    return {
      version: "1",
      intent: calculation === "absolute_change" || calculation === "percentage_change" ? calculation : calculation,
      metricId: metric.objectId,
      groupBy: concepts.groupBy.includes("municipality") ? [{ dimensionId: "geography" }] : [],
      filters: concepts.geography.map((name) => ({ dimensionId: "geography", operator: "eq", values: [name] })),
      timeRange:
        concepts.timeExpression?.type === "year" && typeof concepts.timeExpression.value === "number"
          ? { periods: [String(concepts.timeExpression.value)] }
          : concepts.timeExpression?.type === "after" && typeof concepts.timeExpression.value === "number"
            ? { startPeriod: String(concepts.timeExpression.value) }
            : concepts.timeExpression?.type === "between" && Array.isArray(concepts.timeExpression.value)
              ? { startPeriod: String(concepts.timeExpression.value[0]), endPeriod: String(concepts.timeExpression.value[1]) }
              : undefined,
      comparison:
        concepts.timeExpression?.type === "between" && Array.isArray(concepts.timeExpression.value)
          ? { basePeriod: String(concepts.timeExpression.value[0]), comparisonPeriod: String(concepts.timeExpression.value[1]), method: calculation === "percentage_change" ? "percentage" : "absolute" }
          : undefined,
      orderBy: concepts.sortDirection ? [{ field: "value", direction: concepts.sortDirection }] : undefined,
      limit: concepts.limit ?? 20,
      includeMissing: false,
    };
  }

  async generateAnswer(context: {
    question: string;
    resolvedInterpretation: AnalyticalQueryPlan;
    result: QueryExecutionResult;
    validationWarnings: QueryWarning[];
  }): Promise<GeneratedAnswer> {
    const rows = context.result.rows.slice(0, 5);
    return {
      title: `Result for "${context.question}"`,
      summary: `Guara executed a validated ${context.resolvedInterpretation.intent} query and returned ${context.result.rowCount} row(s).`,
      bullets: rows.map((row) => Object.entries(row).map(([key, value]) => `${key}: ${value ?? "unknown"}`).join(" · ")),
      warnings: context.validationWarnings,
    };
  }
}
