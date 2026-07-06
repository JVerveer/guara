import { useEffect, useState } from "react";
import { researchService } from "../services/researchService";
import type { ResearchQuery } from "../types";

interface UseResearchQueryResult {
  /** The resolved research result, or null while loading / on error. */
  result: ResearchQuery | null;
  isLoading: boolean;
  error: Error | null;
  /** Refetch the current query. */
  retry: () => void;
}

/**
 * Fetches the research result for a given question.
 *
 * Handles all async lifecycle states so page components can render
 * <LoadingState />, <ErrorState />, or <EmptyState /> declaratively.
 */
export function useResearchQuery(question?: string): UseResearchQueryResult {
  const [result, setResult] = useState<ResearchQuery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    researchService
      .getResult(question)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [question, fetchKey]);

  const retry = () => setFetchKey((k) => k + 1);

  return { result, isLoading, error, retry };
}
