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
    excerpt: cleanExcerpt(args.excerpt).slice(0, 500),
    page: args.page,
    chunkId: args.chunkId,
    confidence: confidence(args.confidence ?? 0.75),
  };
}

export function cleanExcerpt(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function findSentenceStart(text: string, index: number) {
  const before = text.slice(0, index);

  const sentenceBoundary = Math.max(
    before.lastIndexOf('. '),
    before.lastIndexOf('! '),
    before.lastIndexOf('? '),
    before.lastIndexOf('\n')
  );

  if (sentenceBoundary >= 0) {
    return sentenceBoundary + 1;
  }

  const whitespaceBoundary = before.lastIndexOf(' ');

  if (whitespaceBoundary >= 0) {
    return whitespaceBoundary + 1;
  }

  return 0;
}

function findSentenceEnd(text: string, index: number) {
  const after = text.slice(index);

  const candidates = [
    after.indexOf('. '),
    after.indexOf('! '),
    after.indexOf('? '),
    after.indexOf('\n'),
  ].filter((value) => value >= 0);

  if (candidates.length > 0) {
    return index + Math.min(...candidates) + 1;
  }

  const nextSpace = text.indexOf(' ', index + 220);

  if (nextSpace >= 0) {
    return nextSpace;
  }

  return Math.min(text.length, index + 300);
}

export function findBestExcerpt(text: string, terms: string[], radius = 160) {
  const lower = text.toLowerCase();

  for (const term of terms) {
    const index = lower.indexOf(term.toLowerCase());

    if (index >= 0) {
      const roughStart = Math.max(0, index - radius);
      const roughEnd = Math.min(text.length, index + term.length + radius);

      const start = findSentenceStart(text, roughStart);
      const end = findSentenceEnd(text, roughEnd);

      return cleanExcerpt(text.slice(start, end));
    }
  }

  return cleanExcerpt(text.slice(0, 300));
}

export function includesAny(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}