import type { AnalyticalIntent, ExtractedConcepts } from "../types";

const MUNICIPALITIES = ["Amsterdam", "Rotterdam", "Utrecht", "Groningen", "Eindhoven", "Den Haag", "Maastricht", "Nijmegen"];

function calculation(query: string): AnalyticalIntent | undefined {
  const lower = query.toLowerCase();
  if (/share|aandeel|percentage of total/.test(lower)) return "share_of_total";
  if (/percentage change|percentuele/.test(lower)) return "percentage_change";
  if (/increase|decrease|changed|gestegen|gedaald|toegenomen|afgenomen/.test(lower)) return "absolute_change";
  if (/compare|vergelijk/.test(lower)) return "comparison";
  if (/trend|since|after|ontwikkeling/.test(lower)) return "trend";
  if (/highest|lowest|most|least|top|meeste|hoogste|laagste/.test(lower)) return "ranking";
  return undefined;
}

export function extractConcepts(query: string): ExtractedConcepts {
  const lower = query.toLowerCase();
  const years = Array.from(query.matchAll(/\b(19[7-9]\d|20[0-2]\d)\b/g)).map((match) => Number(match[1]));
  const geography = MUNICIPALITIES.filter((name) => lower.includes(name.toLowerCase()));
  const groupBy = /municipalit|gemeenten|gemeente/.test(lower) ? ["municipality"] : [];
  const calc = calculation(query);
  const firstYear = years[0];

  return {
    metricPhrase: query
      .replace(/\b(which|what|why|compare|municipalities|gemeenten|gemeente|highest|lowest|most|least|after|since|before)\b/gi, " ")
      .replace(/\b(19[7-9]\d|20[0-2]\d)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    groupBy,
    dimensionValues: [],
    geography,
    timeExpression:
      years.length >= 2 ? { type: "between", value: [Math.min(...years), Math.max(...years)] }
        : firstYear && /\bafter|since|na\b/i.test(query) ? { type: "after", value: firstYear }
        : firstYear && /\bbefore|voor\b/i.test(query) ? { type: "before", value: firstYear }
        : firstYear ? { type: "year", value: firstYear }
        : undefined,
    comparisonEntities: /compare|vergelijk/.test(lower) ? geography : [],
    calculation: calc,
    sortDirection: /lowest|least|laagste|minst/.test(lower) ? "asc" : /highest|most|hoogste|meeste|increased/.test(lower) ? "desc" : undefined,
    limit: Number(query.match(/\btop\s+(\d{1,2})\b/i)?.[1] ?? "") || undefined,
    normalization: /per capita|per inwoner/.test(lower) ? "per_capita" : /percent|percentage|procent/.test(lower) ? "percentage" : undefined,
  };
}
