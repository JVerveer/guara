import { getSupabaseClient, isSupabaseConfigured } from "@/data/supabase/client";
import { answerStorageService } from "./answerStorageService";
import { extractConcepts } from "./conceptExtraction";
import { classifySearchRequest } from "./intentClassifier";
import { createRequestId, logSearchEvent, logSearchFailure } from "./searchObservability";
import type { SearchFilters, SearchObjectType, SearchResult } from "../types";

function hashEmbedding(text: string): string {
  const vector = new Array(64).fill(0);
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const token of tokens) {
    let hash = 2166136261;
    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    for (let index = 0; index < 4; index += 1) {
      const slot = Math.abs((hash >> (index * 8)) % vector.length);
      vector[slot] += (hash & (1 << index)) === 0 ? 1 : -1;
    }
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return `[${vector.map((value) => (value / norm).toFixed(6)).join(",")}]`;
}

export const searchService = {
  async search({
    query,
    objectTypes,
    filters = {},
    limit = 20,
    developmentMode = false,
  }: {
    query: string;
    objectTypes?: SearchObjectType[];
    filters?: SearchFilters;
    limit?: number;
    developmentMode?: boolean;
  }): Promise<{
    query: string;
    classification: ReturnType<typeof classifySearchRequest>;
    concepts: ReturnType<typeof extractConcepts>;
    results: SearchResult[];
    groups: Record<string, number>;
  }> {
    const classification = classifySearchRequest(query);
    const concepts = extractConcepts(query);
    if (!isSupabaseConfigured()) return { query, classification, concepts, results: [], groups: {} };

    const started = performance.now();
    const requestId = createRequestId();
    const supabase = await getSupabaseClient();
    const rpcArgs = {
      search_query: query,
      query_embedding: hashEmbedding(query),
      match_count: Math.max(1, Math.min(limit, 50)),
      object_types: objectTypes ?? filters.object_type ?? null,
      investigation: filters.investigation_id ?? null,
      filters,
      development_mode: developmentMode,
    };
    let { data, error } = await (supabase as any).rpc("guara_search_documents", rpcArgs);
    if (error && /vector|embedding/i.test(error.message ?? "")) {
      logSearchFailure({
        event: "search_embedding_fallback",
        requestId,
        investigationId: filters.investigation_id ?? null,
        intent: classification.intent,
        failureCategory: "EMBEDDING_PROVIDER_UNAVAILABLE",
      });
      const retry = await (supabase as any).rpc("guara_search_documents", {
        ...rpcArgs,
        query_embedding: null,
      });
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      logSearchFailure({
        event: "search_failed",
        requestId,
        investigationId: filters.investigation_id ?? null,
        intent: classification.intent,
        searchDurationMs: Math.round(performance.now() - started),
        failureCategory: "SEARCH_NO_RESULTS",
      });
      throw error;
    }

    const results = (data ?? []).map((row: any) => ({
      object_type: row.object_type,
      object_id: row.object_id,
      title: row.title,
      subtitle: row.subtitle,
      description: row.description,
      source_name: row.source_name,
      dataset_code: row.dataset_code,
      rank_score: Number(row.rank_score ?? 0),
      result_reason: row.result_reason ?? "Ranked search result",
      matched_terms: row.matched_terms ?? [],
      available_actions: row.available_actions ?? [],
      score_explanation: row.score_explanation,
      metadata: row.metadata ?? {},
    })) as SearchResult[];
    const groups = results.reduce<Record<string, number>>((acc, result) => {
      acc[result.object_type] = (acc[result.object_type] ?? 0) + 1;
      return acc;
    }, {});
    void answerStorageService.recordSearchTelemetry({
      query,
      language: classification.language,
      intent: classification.intent,
      durationMs: Math.round(performance.now() - started),
      zeroResult: results.length === 0,
      filters,
      investigationId: filters.investigation_id ?? null,
      selectedResultId: results[0] ? `${results[0].object_type}:${results[0].object_id}` : null,
    });
    logSearchEvent({
      event: "search_completed",
      requestId,
      investigationId: filters.investigation_id ?? null,
      intent: classification.intent,
      searchDurationMs: Math.round(performance.now() - started),
      resultRowCount: results.length,
      failureCategory: results.length === 0 ? "SEARCH_NO_RESULTS" : undefined,
    });

    return { query, classification, concepts, results, groups };
  },

  async searchGoldOnlyInvestigation({
    query,
    domainId,
    objectTypes,
    limit = 20,
    hasFactData,
  }: {
    query: string;
    domainId?: string;
    objectTypes?: SearchObjectType[];
    limit?: number;
    hasFactData?: boolean;
  }) {
    return this.search({
      query,
      objectTypes,
      limit,
      filters: {
        strict_gold_only: true,
        domain_id: domainId,
        has_fact_data: hasFactData,
      },
    });
  },
};
