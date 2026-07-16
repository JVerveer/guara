import type { IntentClassification, RequestIntent } from "../types";

function detectLanguage(query: string): IntentClassification["language"] {
  const lower = query.toLowerCase();
  if (/\b(welke|waarom|gemeente|gemeenten|uitgaven|ontwikkeling|vergelijk|betekent|gegevens)\b/.test(lower)) return "nl";
  if (/\b(which|what|why|compare|spending|definition|data|trend|increase)\b/.test(lower)) return "en";
  return "unknown";
}

export function classifySearchRequest(query: string): IntentClassification {
  const normalized = query.trim();
  const lower = normalized.toLowerCase();
  const language = detectLanguage(normalized);

  let intent: RequestIntent = "catalogue_search";
  let confidence = 0.62;
  let reason = "Defaulted to catalogue search.";

  if (!normalized) return { intent: "unsupported", confidence: 1, language, reason: "Empty query." };

  if (/^[0-9]{4,5}[a-z]{3}$/i.test(normalized)) {
    return { intent: "catalogue_search", confidence: 0.98, language, reason: "Exact CBS dataset code pattern." };
  }

  if (/what does|meaning|definition|betekent|definitie/.test(lower)) {
    intent = "definition_question";
    confidence = 0.9;
    reason = "Definition phrase detected.";
  } else if (/do we have|which dataset|find data|gegevens over|data about/.test(lower)) {
    intent = "data_availability_question";
    confidence = 0.88;
    reason = "Data availability phrase detected.";
  } else if (/compare|vergelijk/.test(lower)) {
    intent = "analytical_comparison";
    confidence = 0.86;
    reason = "Comparison phrase detected.";
  } else if (/trend|since|after|before|ontwikkeling|verander|changed/.test(lower)) {
    intent = "analytical_trend";
    confidence = 0.82;
    reason = "Time-development phrase detected.";
  } else if (/increase|decrease|changed most|gestegen|gedaald|toegenomen|afgenomen/.test(lower)) {
    intent = "analytical_change";
    confidence = 0.82;
    reason = "Change phrase detected.";
  } else if (/share|percentage of total|aandeel/.test(lower)) {
    intent = "analytical_share";
    confidence = 0.82;
    reason = "Share-of-total phrase detected.";
  } else if (/highest|lowest|most|least|top|rank|meeste|hoogste|laagste|rang/.test(lower)) {
    intent = "analytical_ranking";
    confidence = 0.84;
    reason = "Ranking phrase detected.";
  } else if (/amsterdam|rotterdam|utrecht|groningen|den haag|gemeente|municipality/.test(lower)) {
    intent = "entity_lookup";
    confidence = 0.72;
    reason = "Known entity or entity type detected.";
  }

  return { intent, confidence, language, reason };
}
