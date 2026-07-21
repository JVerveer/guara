import type { SemanticDimensionContract } from "./semanticContractService";
import { normalizeSemanticText } from "./semanticUtils";

interface ResolvedDimensionFilter {
  dimension_code: string;
  category_value: string;
  reason: string;
}

function constructionYear(question: string): number | null {
  const match = question.match(/\b(?:bouwjaar|gebouwd(?:e)?(?:\s+in)?|bouwperiode)\s*(19[0-9]\d|20[0-2]\d)\b/i)
    ?? question.match(/\b(19[0-9]\d|20[0-2]\d)\b(?=.*\b(?:bouwjaar|gebouwd(?:e)?|bouwperiode)\b)/i);
  if (!match?.[1]) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function valueName(value: Record<string, unknown>): string | null {
  const name = value.category_name ?? value.category_code;
  return name == null ? null : String(name);
}

function isTotalValue(value: Record<string, unknown>): boolean {
  return value.is_total === true || normalizeSemanticText(valueName(value) ?? "") === "totaal";
}

function constructionYearValue(year: number, values: Array<Record<string, unknown>>): string | null {
  for (const value of values) {
    const name = valueName(value);
    if (!name) continue;
    const normalized = normalizeSemanticText(name);
    const range = normalized.match(/\b(1[0-9]{3}|20[0-9]{2})\s+tot\s+(1[0-9]{3}|20[0-9]{2})\b/);
    if (range?.[1] && range[2] && year >= Number(range[1]) && year < Number(range[2])) return name;
    const from = normalized.match(/\bvanaf\s+(1[0-9]{3}|20[0-9]{2})\b/);
    if (from?.[1] && year >= Number(from[1])) return name;
  }
  return null;
}

function questionMentionsValue(question: string, value: Record<string, unknown>): boolean {
  if (isTotalValue(value)) return false;
  const name = valueName(value);
  if (!name) return false;
  const normalizedQuestion = normalizeSemanticText(question);
  const normalizedName = normalizeSemanticText(name);
  if (normalizedName.length >= 4 && normalizedQuestion.includes(normalizedName)) return true;
  const tokens = normalizedName.split(" ").filter((token) => token.length >= 5);
  return tokens.length > 0 && tokens.every((token) => normalizedQuestion.includes(token));
}

function datasetContracts(datasetCode: string | undefined, contracts: SemanticDimensionContract[]): SemanticDimensionContract[] {
  return (contracts ?? [])
    .filter((contract) => !datasetCode || !contract.dataset_code || contract.dataset_code === datasetCode)
    .sort((left, right) => {
      if (left.dataset_code && !right.dataset_code) return -1;
      if (!left.dataset_code && right.dataset_code) return 1;
      return left.dimension_code.localeCompare(right.dimension_code);
    });
}

export function resolveDimensionFilters(
  question: string,
  datasetCode: string | undefined,
  existingFilters: Record<string, string> | undefined,
  contracts: SemanticDimensionContract[]
): { filters?: Record<string, string>; explanations: string[] } {
  const filters: Record<string, string> = { ...(existingFilters ?? {}) };
  const explanations: string[] = [];
  const year = constructionYear(question);
  const resolved: ResolvedDimensionFilter[] = [];

  for (const contract of datasetContracts(datasetCode, contracts)) {
    if (filters[contract.dimension_code]) continue;
    const values = contract.valid_values ?? [];
    if (!values.length) continue;

    if (year != null && /bouwjaar|bouwjaarklasse|bouwperiode/i.test(contract.dimension_code)) {
      const category = constructionYearValue(year, values);
      if (category) {
        resolved.push({
          dimension_code: contract.dimension_code,
          category_value: category,
          reason: `Mapped construction year ${year} to ${contract.dimension_code}=${category}.`,
        });
        continue;
      }
    }

    const mentioned = values.find((value) => questionMentionsValue(question, value));
    if (mentioned) {
      const category = valueName(mentioned);
      if (category) {
        resolved.push({
          dimension_code: contract.dimension_code,
          category_value: category,
          reason: `Matched question text to ${contract.dimension_code}=${category}.`,
        });
      }
    }
  }

  for (const item of resolved) {
    filters[item.dimension_code] = item.category_value;
    explanations.push(item.reason);
  }

  return {
    filters: Object.keys(filters).length ? filters : undefined,
    explanations,
  };
}
