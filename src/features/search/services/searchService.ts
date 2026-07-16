import { getSupabaseClient, isSupabaseConfigured } from "@/data/supabase/client";
import { extractConcepts } from "./conceptExtraction";
import { classifySearchRequest } from "./intentClassifier";
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

    const supabase = await getSupabaseClient();
    const { data, error } = await (supabase as any).rpc("guara_search_documents", {
      search_query: query,
      query_embedding: hashEmbedding(query),
      match_count: Math.max(1, Math.min(limit, 50)),
      object_types: objectTypes ?? filters.object_type ?? null,
      investigation: filters.investigation_id ?? null,
      filters,
      development_mode: developmentMode,
    });
    if (error) throw error;

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

    return { query, classification, concepts, results, groups };
  },
};
