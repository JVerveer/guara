export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function tokenizeSearchText(value: string): string[] {
  return normalizeSearchText(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function isExactCodeMatch(query: string, candidate: { objectCode?: string | null; datasetCode?: string | null; objectId?: string | null }): boolean {
  const normalized = normalizeSearchText(query);
  return [candidate.objectCode, candidate.datasetCode, candidate.objectId]
    .filter(Boolean)
    .some((value) => normalizeSearchText(String(value)) === normalized);
}
