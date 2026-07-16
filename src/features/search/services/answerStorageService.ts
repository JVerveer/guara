import { getSupabaseClient, isSupabaseConfigured } from "@/data/supabase/client";
import type {
  AnalyticalQueryPlan,
  AnswerFeedbackType,
  CompiledQuery,
  GeneratedAnswer,
  IntentClassification,
  QueryExecutionResult,
  QueryWarning,
  RankedSemanticCandidate,
} from "../types";

function normalizeQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ").toLowerCase();
}

function fingerprint(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function redactParameter(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return { type: "array", length: value.length, itemTypes: [...new Set(value.map((item) => typeof item))] };
  }
  if (value === null) return { type: "null" };
  return { type: typeof value };
}

function boundedRows(rows: Array<Record<string, unknown>>, limit = 50): Array<Record<string, unknown>> {
  return rows.slice(0, limit);
}

async function safeInsert<T>(table: string, row: Record<string, unknown>, idColumn: string): Promise<T | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await (supabase as any).schema("answer").from(table).insert(row).select(idColumn).single();
    if (error) {
      console.warn(`Could not store ${table}`, error);
      return null;
    }
    return data?.[idColumn] ? ({ [idColumn]: data[idColumn] } as T) : null;
  } catch (error) {
    console.warn(`Could not store ${table}`, error);
    return null;
  }
}

export const answerStorageService = {
  normalizeQuestion,

  async createQueryRequest({
    question,
    classification,
    investigationId,
  }: {
    question: string;
    classification: IntentClassification;
    investigationId?: string | null;
  }): Promise<{ queryRequestId: string } | null> {
    const stored = await safeInsert<{ query_request_id: string }>(
      "query_request",
      {
        original_question: question,
        normalized_question: normalizeQuestion(question),
        detected_language: classification.language,
        classified_intent: classification.intent,
        classification_confidence: classification.confidence,
        investigation_id: investigationId ?? null,
        permission_scope: investigationId ? `investigation:${investigationId}` : "global",
      },
      "query_request_id"
    );
    return stored ? { queryRequestId: stored.query_request_id } : null;
  },

  async recordResolution({
    queryRequestId,
    plan,
    candidates,
    ambiguities = [],
    status = "resolved",
  }: {
    queryRequestId: string;
    plan?: AnalyticalQueryPlan | null;
    candidates: RankedSemanticCandidate[];
    ambiguities?: unknown[];
    status?: "resolved" | "needs_resolution" | "invalid";
  }): Promise<void> {
    await safeInsert(
      "query_resolution",
      {
        query_request_id: queryRequestId,
        resolved_metric_id: plan?.metricId ?? null,
        resolved_dimensions: plan?.groupBy ?? [],
        resolved_filters: plan?.filters ?? [],
        ambiguities,
        semantic_candidates: candidates.slice(0, 20),
        resolution_status: status,
      },
      "query_resolution_id"
    );
  },

  async recordExecution({
    queryRequestId,
    plan,
    compiled,
    result,
    status,
    warnings = [],
  }: {
    queryRequestId: string;
    plan: AnalyticalQueryPlan;
    compiled: CompiledQuery;
    result?: QueryExecutionResult;
    status: "success" | "failed" | "invalid";
    warnings?: QueryWarning[];
  }): Promise<{ queryExecutionId: string } | null> {
    const stored = await safeInsert<{ query_execution_id: string }>(
      "query_execution",
      {
        query_request_id: queryRequestId,
        query_plan_version: plan.version,
        query_plan: plan,
        query_plan_hash: fingerprint(plan),
        compiled_sql: compiled.sql,
        compiled_sql_fingerprint: fingerprint(compiled.sql),
        compiled_parameters_redacted: compiled.parameters.map(redactParameter),
        execution_duration_ms: result?.durationMs ?? null,
        result_row_count: result?.rowCount ?? null,
        execution_status: status,
        warnings,
      },
      "query_execution_id"
    );
    return stored ? { queryExecutionId: stored.query_execution_id } : null;
  },

  async recordGeneratedAnswer({
    queryRequestId,
    queryExecutionId,
    answer,
    result,
    provider = "deterministic",
    modelName = "fallback",
    promptVersion = "search-answer-v1",
  }: {
    queryRequestId: string;
    queryExecutionId?: string | null;
    answer: GeneratedAnswer;
    result: QueryExecutionResult;
    provider?: string;
    modelName?: string;
    promptVersion?: string;
  }): Promise<{ answerId: string } | null> {
    const stored = await safeInsert<{ answer_id: string }>(
      "generated_answer",
      {
        query_request_id: queryRequestId,
        query_execution_id: queryExecutionId ?? null,
        answer_text: [answer.title, answer.summary, ...answer.bullets].filter(Boolean).join("\n\n"),
        answer_payload: answer,
        result_snapshot: {
          rows: boundedRows(result.rows),
          row_count: result.rowCount,
          snapshot_limit: 50,
        },
        warnings: answer.warnings,
        model_provider: provider,
        model_name: modelName,
        prompt_version: promptVersion,
      },
      "answer_id"
    );
    return stored ? { answerId: stored.answer_id } : null;
  },

  async recordAnswerSources({
    answerId,
    sources,
  }: {
    answerId: string;
    sources: Array<{
      datasetKey?: number | null;
      datasetCode?: string | null;
      datasetVersion?: string | null;
      sourceKey?: number | null;
      sourceName?: string | null;
      metricId?: string | null;
      measureKey?: number | null;
      recordCount?: number | null;
      metadata?: Record<string, unknown>;
    }>;
  }): Promise<void> {
    if (!isSupabaseConfigured() || sources.length === 0) return;
    try {
      const supabase = await getSupabaseClient();
      const { error } = await (supabase as any).schema("answer").from("answer_source").insert(
        sources.map((source) => ({
          answer_id: answerId,
          dataset_key: source.datasetKey ?? null,
          dataset_code: source.datasetCode ?? null,
          dataset_version: source.datasetVersion ?? null,
          source_key: source.sourceKey ?? null,
          source_name: source.sourceName ?? null,
          metric_id: source.metricId ?? null,
          measure_key: source.measureKey ?? null,
          record_count: source.recordCount ?? null,
          source_metadata: source.metadata ?? {},
        }))
      );
      if (error) console.warn("Could not store answer sources", error);
    } catch (error) {
      console.warn("Could not store answer sources", error);
    }
  },

  async recordSearchTelemetry({
    query,
    language,
    intent,
    durationMs,
    zeroResult,
    filters,
    investigationId,
    selectedResultId,
    answerSuccess,
  }: {
    query: string;
    language?: string;
    intent?: string;
    durationMs?: number;
    zeroResult: boolean;
    filters?: Record<string, unknown>;
    investigationId?: string | null;
    selectedResultId?: string | null;
    answerSuccess?: boolean | null;
  }): Promise<void> {
    if (!isSupabaseConfigured()) return;
    try {
      const supabase = await getSupabaseClient();
      await (supabase as any).rpc("guara_record_search_telemetry", {
        normalized_query: normalizeQuestion(query),
        query_language: language ?? null,
        classified_intent: intent ?? null,
        search_duration_ms: durationMs ?? null,
        zero_result: zeroResult,
        filters: filters ?? {},
        investigation_id: investigationId ?? null,
        workspace_id: null,
        selected_result_id: selectedResultId ?? null,
        answer_success: answerSuccess ?? null,
      });
    } catch (error) {
      console.warn("Could not store search telemetry", error);
    }
  },

  async saveAnalysis({
    answerId,
    title,
    description,
    displayConfiguration = {},
  }: {
    answerId: string;
    title?: string;
    description?: string;
    displayConfiguration?: Record<string, unknown>;
  }): Promise<{ savedAnalysisId: string } | null> {
    if (!isSupabaseConfigured()) return null;
    const supabase = await getSupabaseClient();
    const { data, error } = await (supabase as any).rpc("guara_save_answer_analysis", {
      answer_id: answerId,
      title: title ?? null,
      description: description ?? null,
      display_configuration: displayConfiguration,
    });
    if (error) throw error;
    return data ? { savedAnalysisId: data } : null;
  },

  async recordFeedback({
    answerId,
    rating,
    feedbackType,
    comment,
    correctedInterpretation,
  }: {
    answerId: string;
    rating?: string;
    feedbackType: AnswerFeedbackType;
    comment?: string;
    correctedInterpretation?: Record<string, unknown>;
  }): Promise<string | null> {
    if (!isSupabaseConfigured()) return null;
    const supabase = await getSupabaseClient();
    const { data, error } = await (supabase as any).rpc("guara_record_answer_feedback", {
      answer_id: answerId,
      rating: rating ?? null,
      feedback_type: feedbackType,
      comment: comment ?? null,
      corrected_interpretation: correctedInterpretation ?? null,
    });
    if (error) throw error;
    return data ?? null;
  },

  async convertSavedAnalysisToEvidence({
    savedAnalysisId,
    targetId,
    metadata = {},
  }: {
    savedAnalysisId: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string | null> {
    if (!isSupabaseConfigured()) return null;
    const supabase = await getSupabaseClient();
    const { data, error } = await (supabase as any).rpc("guara_convert_saved_analysis_to_evidence", {
      saved_analysis_id: savedAnalysisId,
      target_id: targetId ?? null,
      metadata,
    });
    if (error) throw error;
    return data ?? null;
  },
};
