import type { FactSource } from './types';

export function createFactId(prefix: string, parts: Array<string | number | undefined>) {
  return `${prefix}-${parts.filter(Boolean).join('-')}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function confidence(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function makeSource(args: {
  document: string;
  excerpt: string;
  page?: number;
  chunkId?: string;
  confidence?: number;
}): FactSource {
  return {
    document: args.document,
    excerpt: args.excerpt.trim().slice(0, 500),
    page: args.page,
    chunkId: args.chunkId,
    confidence: confidence(args.confidence ?? 0.75),
  };
}

export function findBestExcerpt(text: string, terms: string[], radius = 120) {
  const lower = text.toLowerCase();

  for (const term of terms) {
    const index = lower.indexOf(term.toLowerCase());

    if (index >= 0) {
      const start = Math.max(0, index - radius);
      const end = Math.min(text.length, index + term.length + radius);

      return text.slice(start, end).replace(/\s+/g, ' ').trim();
    }
  }

  return text.slice(0, 300).replace(/\s+/g, ' ').trim();
}

export function includesAny(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}
