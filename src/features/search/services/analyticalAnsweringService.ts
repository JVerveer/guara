import { generateEvidenceBackedAnswer } from "./answerGeneration";
import { answerStorageService } from "./answerStorageService";
import { DeterministicFallbackLlmProvider, type LlmProvider } from "./llmProvider";
import { executeCompiledQuery, type CompiledQueryRunner } from "./queryExecutor";
import { validateQueryResult } from "./resultValidation";
import { searchService } from "./searchService";
import { createRequestId, logSearchEvent, logSearchFailure } from "./searchObservability";
import { validateSemanticQueryPlan } from "./semanticPlanValidator";
import { compileAnalyticalQuery } from "./sqlCompiler";
import type { GeneratedAnswer, PlanValidationResult, RankedSemanticCandidate } from "../types";

export async function answerAnalyticalQuestion({
  question,
  runner,
  provider = new DeterministicFallbackLlmProvider(),
  strictGoldOnly = true,
  domainId = "bouwen-en-wonen",
}: {
  question: string;
  runner: CompiledQueryRunner;
  provider?: LlmProvider;
  strictGoldOnly?: boolean;
  domainId?: string;
}): Promise<
  | { status: "answered"; answer: GeneratedAnswer }
  | { status: "needs_resolution"; validation: PlanValidationResult }
  | { status: "invalid"; validation: PlanValidationResult }
> {
  const requestId = createRequestId();
  const started = performance.now();
  const search = strictGoldOnly
    ? await searchService.searchGoldOnlyInvestigation({
      query: question,
      domainId,
      objectTypes: ["metric", "dimension", "geography", "dataset"],
      limit: 12,
    })
    : await searchService.search({ query: question, objectTypes: ["metric", "dimension", "geography", "dataset"], limit: 12 });
  const queryRequest = await answerStorageService.createQueryRequest({
    question,
    classification: search.classification,
    investigationId: null,
  });
  const rankedCandidates: RankedSemanticCandidate[] = search.results.map((result) => ({
    objectType: result.object_type,
    objectId: String(result.metadata.metric_id ?? result.object_id),
    title: result.title,
    score: result.rank_score,
    metadata: result.metadata,
  }));

  let plan = null;
  const planningStarted = performance.now();
  try {
    plan = await provider.createQueryPlan({
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
  } catch {
    logSearchFailure({
      event: "answer_planning_failed",
      requestId,
      intent: search.classification.intent,
      llmDurationMs: Math.round(performance.now() - planningStarted),
      failureCategory: "LLM_PROVIDER_UNAVAILABLE",
    });
    return {
      status: "needs_resolution",
      validation: {
        status: "needs_resolution",
        errors: [{ code: "LLM_PROVIDER_UNAVAILABLE", message: "The planning provider is unavailable. Discovery search still works, but Guara cannot safely produce an analytical answer yet." }],
        warnings: [],
        ambiguities: [],
      },
    };
  }

  if (!plan) {
    if (queryRequest) {
      await answerStorageService.recordResolution({
        queryRequestId: queryRequest.queryRequestId,
        candidates: rankedCandidates,
        ambiguities: [{ field: "metric", question: "Which metric should be used?", options: rankedCandidates.slice(0, 5).map((candidate) => ({ id: candidate.objectId, label: candidate.title })) }],
        status: "needs_resolution",
      });
    }
    logSearchFailure({
      event: "answer_needs_resolution",
      requestId,
      intent: search.classification.intent,
      failureCategory: rankedCandidates.length === 0 ? "SEARCH_NO_RESULTS" : "AMBIGUOUS_METRIC",
    });
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
  if (queryRequest) {
    await answerStorageService.recordResolution({
      queryRequestId: queryRequest.queryRequestId,
      plan,
      candidates: rankedCandidates,
      ambiguities: validation.ambiguities,
      status: validation.status,
    });
  }
  if (validation.status !== "valid") {
    logSearchFailure({
      event: "answer_validation_failed",
      requestId,
      intent: search.classification.intent,
      resolvedMetric: plan.metricId,
      queryPlanVersion: plan.version,
      warningCount: validation.warnings.length,
      failureCategory: validation.errors[0]?.code,
    });
    return { status: validation.status, validation };
  }

  const compiled = compileAnalyticalQuery(plan);
  const execution = await executeCompiledQuery(compiled, runner);
  if (!execution.ok) {
    if (queryRequest) {
      await answerStorageService.recordExecution({
        queryRequestId: queryRequest.queryRequestId,
        plan,
        compiled,
        status: "failed",
      });
    }
    logSearchFailure({
      event: "answer_execution_failed",
      requestId,
      intent: search.classification.intent,
      resolvedMetric: plan.metricId,
      queryPlanVersion: plan.version,
      failureCategory: execution.error.code,
    });
    return {
      status: "invalid",
      validation: { status: "invalid", errors: [execution.error], warnings: [], ambiguities: [] },
    };
  }

  const resultValidation = validateQueryResult(compiled, execution.result);
  if (resultValidation.status === "invalid") {
    if (queryRequest) {
      await answerStorageService.recordExecution({
        queryRequestId: queryRequest.queryRequestId,
        plan,
        compiled,
        result: execution.result,
        status: "invalid",
        warnings: resultValidation.warnings,
      });
    }
    logSearchFailure({
      event: "answer_result_invalid",
      requestId,
      intent: search.classification.intent,
      resolvedMetric: plan.metricId,
      queryPlanVersion: plan.version,
      sqlExecutionDurationMs: execution.result.durationMs,
      resultRowCount: execution.result.rowCount,
      warningCount: resultValidation.warnings.length,
      failureCategory: resultValidation.errors[0]?.code,
    });
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
  if (queryRequest) {
    const queryExecution = await answerStorageService.recordExecution({
      queryRequestId: queryRequest.queryRequestId,
      plan,
      compiled,
      result: execution.result,
      status: "success",
      warnings: [...execution.result.warnings, ...resultValidation.warnings],
    });
    const storedAnswer = await answerStorageService.recordGeneratedAnswer({
      queryRequestId: queryRequest.queryRequestId,
      queryExecutionId: queryExecution?.queryExecutionId,
      answer,
      result: execution.result,
    });
    if (storedAnswer) {
      const metric = rankedCandidates.find((candidate) => candidate.objectType === "metric");
      await answerStorageService.recordAnswerSources({
        answerId: storedAnswer.answerId,
        sources: [
          {
            datasetKey: typeof metric?.metadata.dataset_key === "number" ? metric.metadata.dataset_key : null,
            datasetCode: typeof metric?.metadata.dataset_code === "string" ? metric.metadata.dataset_code : null,
            datasetVersion: typeof metric?.metadata.dataset_version === "string" ? metric.metadata.dataset_version : null,
            sourceName: typeof metric?.metadata.source_provider === "string" ? metric.metadata.source_provider : "CBS",
            metricId: plan.metricId,
            measureKey: typeof metric?.metadata.measure_key === "number" ? metric.metadata.measure_key : null,
            recordCount: execution.result.rowCount,
            metadata: metric?.metadata,
          },
        ],
      });
    }
  }
  logSearchEvent({
    event: "answer_completed",
    requestId,
    intent: search.classification.intent,
    resolvedMetric: plan.metricId,
    queryPlanVersion: plan.version,
    sqlExecutionDurationMs: execution.result.durationMs,
    searchDurationMs: Math.round(performance.now() - started),
    resultRowCount: execution.result.rowCount,
    warningCount: answer.warnings.length,
  });

  return { status: "answered", answer };
}
