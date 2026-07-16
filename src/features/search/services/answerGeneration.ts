import { DeterministicFallbackLlmProvider, type LlmProvider } from "./llmProvider";
import type { AnalyticalQueryPlan, GeneratedAnswer, QueryExecutionResult, QueryWarning } from "../types";

export async function generateEvidenceBackedAnswer({
  provider = new DeterministicFallbackLlmProvider(),
  question,
  plan,
  result,
  metricDefinition,
  unit,
  datasetMetadata,
  caveats = [],
  validationWarnings = [],
}: {
  provider?: LlmProvider;
  question: string;
  plan: AnalyticalQueryPlan;
  result: QueryExecutionResult;
  metricDefinition?: string;
  unit?: string;
  datasetMetadata?: Record<string, unknown>;
  caveats?: QueryWarning[];
  validationWarnings?: QueryWarning[];
}): Promise<GeneratedAnswer> {
  return provider.generateAnswer({
    question,
    resolvedInterpretation: plan,
    result,
    metricDefinition,
    unit,
    datasetMetadata,
    caveats,
    validationWarnings,
  });
}
