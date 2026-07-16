import { generateEvidenceBackedAnswer } from "./answerGeneration";
import { DeterministicFallbackLlmProvider, type LlmProvider } from "./llmProvider";
import { executeCompiledQuery, type CompiledQueryRunner } from "./queryExecutor";
import { validateQueryResult } from "./resultValidation";
import { searchService } from "./searchService";
import { validateSemanticQueryPlan } from "./semanticPlanValidator";
import { compileAnalyticalQuery } from "./sqlCompiler";
import type { GeneratedAnswer, PlanValidationResult, RankedSemanticCandidate } from "../types";

export async function answerAnalyticalQuestion({
  question,
  runner,
  provider = new DeterministicFallbackLlmProvider(),
}: {
  question: string;
  runner: CompiledQueryRunner;
  provider?: LlmProvider;
}): Promise<
  | { status: "answered"; answer: GeneratedAnswer }
  | { status: "needs_resolution"; validation: PlanValidationResult }
  | { status: "invalid"; validation: PlanValidationResult }
> {
  const search = await searchService.search({ query: question, objectTypes: ["metric", "dimension", "geography", "dataset"], limit: 12 });
  const rankedCandidates: RankedSemanticCandidate[] = search.results.map((result) => ({
    objectType: result.object_type,
    objectId: String(result.metadata.metric_id ?? result.object_id),
    title: result.title,
    score: result.rank_score,
    metadata: result.metadata,
  }));

  const plan = await provider.createQueryPlan({
    question,
    rankedCandidates,
    approvedDimensions: [
      { id: "geography", label: "Geography", type: "geography" },
      { id: "time", label: "Time", type: "time" },
      { id: "dataset", label: "Dataset", type: "dataset" },
      { id: "status", label: "Status", type: "status" },
    ],
    approvedCalculations: [
      { code: "lookup", label: "Lookup" },
      { code: "ranking", label: "Ranking" },
      { code: "trend", label: "Trend" },
      { code: "comparison", label: "Comparison" },
      { code: "absolute_change", label: "Absolute change" },
      { code: "percentage_change", label: "Percentage change" },
      { code: "share_of_total", label: "Share of total" },
    ],
    caveats: [],
    queryExamples: [],
  });

  if (!plan) {
    return {
      status: "needs_resolution",
      validation: {
        status: "needs_resolution",
        errors: [],
        warnings: [],
        ambiguities: [{ field: "metric", question: "Which metric should be used?", options: rankedCandidates.slice(0, 5).map((candidate) => ({ id: candidate.objectId, label: candidate.title })) }],
      },
    };
  }

  const validation = await validateSemanticQueryPlan(plan);
  if (validation.status !== "valid") return { status: validation.status, validation };

  const compiled = compileAnalyticalQuery(plan);
  const execution = await executeCompiledQuery(compiled, runner);
  if (!execution.ok) {
    return {
      status: "invalid",
      validation: { status: "invalid", errors: [execution.error], warnings: [], ambiguities: [] },
    };
  }

  const resultValidation = validateQueryResult(compiled, execution.result);
  if (resultValidation.status === "invalid") {
    return {
      status: "invalid",
      validation: { status: "invalid", errors: resultValidation.errors, warnings: resultValidation.warnings, ambiguities: [] },
    };
  }

  const answer = await generateEvidenceBackedAnswer({
    provider,
    question,
    plan,
    result: execution.result,
    validationWarnings: resultValidation.warnings,
  });

  return { status: "answered", answer };
}
