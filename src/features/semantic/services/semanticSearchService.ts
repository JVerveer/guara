import { getSupabaseClient, isSupabaseConfigured } from "@/data/supabase/client";
import type { SemanticAnswer, SemanticIntent, SemanticQueryPlan, SemanticSearchResult } from "../types";

const MUNICIPALITIES = ["Amsterdam", "Rotterdam", "Utrecht", "Groningen", "Eindhoven", "Den Haag", "Maastricht", "Nijmegen", "Tilburg", "Almere", "Breda", "Haarlem", "Arnhem", "Amersfoort"];

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

function classifyIntent(question: string): SemanticIntent {
  const lower = question.toLowerCase();
  if (/what does|meaning|definition|betekent|definitie/.test(lower)) return "measure_definition";
  if (/which dataset|do we have|dataset|gegevens|data about|data over/.test(lower)) return "dataset_lookup";
  if (/compare|vergelijk/.test(lower)) return "compare_geographies";
  if (/change|changed|trend|since|after|ontwikkeling|verander/.test(lower)) return "trend";
  if (/which municipalities|municipalities.*most|top|highest|lowest|outliers|gemeenten|meeste|hoogste|laagste/.test(lower)) return "rank_geographies";
  if (/\b(show|give|list|toon|laat zien)\b/.test(lower) && MUNICIPALITIES.some((name) => lower.includes(name.toLowerCase()))) return "compare_geographies";
  return "catalogue_search";
}

function extractYear(question: string): number | undefined {
  const match = question.match(/\b(19[7-9]\d|20[0-2]\d)\b/);
  return match ? Number(match[1]) : undefined;
}

function extractGeographies(question: string, results: SemanticSearchResult[]): string[] {
  const lower = question.toLowerCase();
  const named = MUNICIPALITIES.filter((name) => lower.includes(name.toLowerCase()));
  const retrieved = results
    .filter((result) => result.object_type === "geography" && lower.includes(result.title.toLowerCase()))
    .map((result) => result.title);
  return Array.from(new Set([...named, ...retrieved])).slice(0, 6);
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function firstMeasure(question: string, results: SemanticSearchResult[]): SemanticSearchResult | undefined {
  const normalizedQuestion = normalize(question);
  const metrics = results.filter((result) => ["measure", "metric"].includes(result.object_type) && result.metadata?.measure_key);
  return metrics.find((result) => result.metadata?.has_fact_data === true && normalizedQuestion.includes(normalize(result.title)))
    ?? metrics.find((result) => normalizedQuestion.includes(normalize(result.title)))
    ?? metrics.find((result) => result.metadata?.has_fact_data === true)
    ?? results.find((result) => ["measure", "metric"].includes(result.object_type) && result.metadata?.measure_key);
}

function calculationCode(intent: SemanticIntent): string | undefined {
  if (intent === "rank_geographies") return "ranking";
  if (intent === "compare_geographies") return "comparison";
  if (intent === "trend") return "trend";
  if (intent === "measure_definition") return "lookup";
  return undefined;
}

async function hybridSearch(question: string, objectTypes?: string[]): Promise<SemanticSearchResult[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await getSupabaseClient();
  const searchObjectTypes = objectTypes?.map((type) => type === "measure" ? "metric" : type === "category" ? "dimension_value" : type);
  const { data, error } = await (supabase as any).rpc("guara_search_documents", {
    search_query: question,
    query_embedding: hashEmbedding(question),
    match_count: 30,
    object_types: searchObjectTypes ?? null,
    investigation: null,
    filters: {
      strict_gold_only: true,
      domain_id: "bouwen-en-wonen",
    },
    development_mode: false,
  });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    catalogue_item_id: row.search_document_id,
    object_type: row.object_type === "metric" ? "metric" : row.object_type,
    object_id: row.object_id,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    dataset_code: row.dataset_code,
    measure_code: row.metadata?.measure_code ?? row.metadata?.metric_code ?? null,
    geography_code: row.metadata?.geography_code ?? null,
    unit_code: row.metadata?.unit_code ?? null,
    domain_id: row.metadata?.domain_id ?? null,
    provider: row.source_name,
    rank_score: Number(row.rank_score ?? 0),
    lexical_score: Number(row.lexical_score ?? 0),
    vector_score: Number(row.vector_score ?? 0),
    metadata: row.metadata ?? {},
  })) as SemanticSearchResult[];
}

function buildPlan(question: string, intent: SemanticIntent, results: SemanticSearchResult[]): SemanticQueryPlan {
  const measure = firstMeasure(question, results);
  const year = extractYear(question);
  const geographyNames = extractGeographies(question, results);
  const analytical = ["rank_geographies", "compare_geographies", "trend", "measure_definition"].includes(intent);

  if (!analytical || !measure) {
    return {
      intent,
      source: "semantic_catalogue",
      year,
      geography_names: geographyNames,
      limit: 10,
      explanation: [
        "Classified as catalogue retrieval or unresolved analytical request.",
        "No database fact query was compiled unless a Gold measure was resolved with sufficient confidence.",
      ],
    };
  }

  return {
    intent: intent === "measure_definition" ? "measure_definition" : intent,
    source: "gold_bouwen_wonen",
    measure_key: String(measure.metadata.measure_key),
    metric_id: measure.metadata.metric_id == null ? undefined : String(measure.metadata.metric_id),
    metric_code: typeof measure.metadata.metric_code === "string" ? measure.metadata.metric_code : undefined,
    calculation_code: calculationCode(intent) ?? "lookup",
    measure_label: measure.title,
    year,
    geography_names: geographyNames,
    limit: intent === "trend" ? 50 : 10,
    explanation: [
      `Resolved measure "${measure.title}" from the semantic catalogue.`,
      "Compiled to an allowlisted Bouwen en wonen query plan using an approved semantic calculation.",
      "The database RPC validates intent, metric availability, metric-dimension compatibility, approved joins and result limits before execution.",
    ],
  };
}

async function executePlan(plan: SemanticQueryPlan): Promise<Record<string, unknown>> {
  if (!isSupabaseConfigured() || plan.source !== "gold_bouwen_wonen" || !plan.measure_key) return {};
  const supabase = await getSupabaseClient();
  const rpcIntent = plan.intent === "measure_definition" ? "lookup_measure" : plan.intent;
  const { data, error } = await (supabase as any).rpc("guara_execute_query_plan", {
    plan: { ...plan, intent: rpcIntent },
  });
  if (error) return { error: error.message };
  return (data ?? {}) as Record<string, unknown>;
}

function rows(result: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(result.rows) ? (result.rows as Array<Record<string, unknown>>) : [];
}

function answerText(question: string, plan: SemanticQueryPlan, result: Record<string, unknown>, matches: SemanticSearchResult[]) {
  const resultRows = rows(result);
  if (resultRows.length > 0) {
    const bullets = resultRows.slice(0, 5).map((row) =>
      Object.entries(row).map(([key, value]) => `${key}: ${value ?? "unknown"}`).join(" · ")
    );
    return {
      title: `Controlled Gold answer for "${question}"`,
      summary: `Guara executed a validated ${plan.intent} query against ${plan.source}. The result contains ${resultRows.length} row(s) and is backed by the resolved measure "${plan.measure_label}".`,
      bullets,
      confidence: 82,
    };
  }

  const bullets = matches.slice(0, 6).map((match) => `${match.object_type}: ${match.title}${match.subtitle ? ` (${match.subtitle})` : ""}`);
  const executionError = typeof result.error === "string" ? result.error : "";
  return {
    title: `Semantic catalogue results for "${question}"`,
    summary:
      executionError
        ? `Guara resolved a controlled query plan, but did not execute a fact answer: ${executionError}. The catalogue matches below show what is available for inspection.`
        : 
      bullets.length > 0
        ? "Guara found relevant catalogue objects, but did not execute an analytical fact query because the request did not resolve to a complete allowlisted query plan."
        : "No matching semantic catalogue objects were found. Load Gold dimensions and refresh the semantic catalogue.",
    bullets,
    confidence: bullets.length > 0 ? 65 : 0,
  };
}

async function recordProvenance(
  question: string,
  intent: SemanticIntent,
  plan: SemanticQueryPlan,
  result: Record<string, unknown>,
  matches: SemanticSearchResult[],
  confidence: number
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getSupabaseClient();
  const sources = matches.slice(0, 8).map((match) => ({
    object_type: match.object_type,
    object_id: match.object_id,
    title: match.title,
    dataset_code: match.dataset_code,
    measure_code: match.measure_code,
    rank_score: match.rank_score,
  }));
  const { data, error } = await (supabase as any).rpc("guara_record_answer_provenance", {
    question,
    intent,
    query_plan: plan,
    result_summary: result,
    sources,
    confidence,
  });
  if (error) return null;
  return data as string;
}

export const semanticSearchService = {
  async answer(question: string): Promise<SemanticAnswer> {
    const normalized = question.trim() || "Dutch public data";
    const intent = classifyIntent(normalized);
    const objectTypes =
      intent === "dataset_lookup" ? ["dataset"]
        : intent === "measure_definition" ? ["measure"]
          : ["measure", "dataset", "geography"];
    const matches = await hybridSearch(normalized, objectTypes);
    const plan = buildPlan(normalized, intent, matches);
    const execution = await executePlan(plan);
    const text = answerText(normalized, plan, execution, matches);
    const answerId = await recordProvenance(normalized, intent, plan, execution, matches, text.confidence);

    return {
      question: normalized,
      intent,
      answerId,
      title: text.title,
      summary: text.summary,
      bullets: text.bullets,
      confidence: text.confidence,
      searchResults: matches,
      queryPlan: plan,
      executionResult: execution,
      provenance: [
        "Homepage natural-language request",
        "Intent classification",
        "Hybrid semantic catalogue retrieval",
        "Allowlisted query-plan validation",
        plan.source === "gold_bouwen_wonen" ? "Safe Supabase RPC execution against Gold mart" : "Catalogue-only response",
        "Answer provenance stored in semantic.answer_provenance when Supabase permits writes",
      ],
    };
  },
};
