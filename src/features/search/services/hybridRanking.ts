import { isExactCodeMatch, tokenizeSearchText } from "./textNormalization";

export interface HybridRankCandidate {
  objectType: string;
  objectId: string;
  objectCode?: string | null;
  datasetCode?: string | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  searchableText?: string | null;
  synonymsText?: string | null;
  lexicalScore?: number;
  vectorScore?: number;
  popularityScore?: number;
}

export interface HybridRankScore {
  rankScore: number;
  lexicalScore: number;
  vectorScore: number;
  exactMatchScore: number;
  objectTypeBoost: number;
  popularityBoost: number;
  matchedTerms: string[];
}

const OBJECT_TYPE_BOOST: Record<string, number> = {
  metric: 0.08,
  dataset: 0.07,
  geography: 0.06,
  saved_analysis: 0.05,
};

export function scoreHybridResult(query: string, candidate: HybridRankCandidate): HybridRankScore {
  const tokens = tokenizeSearchText(query).filter((token) => token.length >= 3);
  const text = tokenizeSearchText(
    [
      candidate.objectCode,
      candidate.datasetCode,
      candidate.title,
      candidate.subtitle,
      candidate.description,
      candidate.searchableText,
      candidate.synonymsText,
    ].filter(Boolean).join(" ")
  );
  const textSet = new Set(text);
  const matchedTerms = tokens.filter((token) => textSet.has(token) || text.some((part) => part.includes(token)));
  const lexicalScore = candidate.lexicalScore ?? (tokens.length ? matchedTerms.length / tokens.length : 0);
  const vectorScore = candidate.vectorScore ?? 0;
  const exactMatchScore = isExactCodeMatch(query, candidate) ? 1 : 0;
  const objectTypeBoost = OBJECT_TYPE_BOOST[candidate.objectType] ?? 0.02;
  const popularityBoost = Math.min(candidate.popularityScore ?? 0, 100) / 100 * 0.01;

  return {
    rankScore: Number(((exactMatchScore * 1.25) + (lexicalScore * 0.65) + (vectorScore * 0.3) + objectTypeBoost + popularityBoost).toFixed(6)),
    lexicalScore,
    vectorScore,
    exactMatchScore,
    objectTypeBoost,
    popularityBoost,
    matchedTerms,
  };
}
