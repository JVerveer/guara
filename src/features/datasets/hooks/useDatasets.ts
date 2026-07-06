import { useEffect, useMemo, useState } from "react";
import { datasetService } from "../services/datasetService";
import type { Dataset } from "../types";

interface UseDatasetsResult {
  /** All datasets from the service */
  datasets: Dataset[];
  /** Datasets filtered by the current query + active tag */
  filtered: Dataset[];
  query: string;
  setQuery: (q: string) => void;
  activeTag: string | null;
  setActiveTag: (tag: string | null) => void;
  /** True when at least one filter is active */
  hasActiveFilters: boolean;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
}

/**
 * Fetches all datasets and exposes client-side search/filter state.
 *
 * Client-side filtering is appropriate for the current dataset count.
 * Replace with a debounced server-side search when the catalog grows large.
 */
export function useDatasets(): UseDatasetsResult {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    datasetService
      .getAllDatasets()
      .then((data) => {
        if (!cancelled) setDatasets(data);
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
  }, [fetchKey]);

  const filtered = useMemo(
    () =>
      datasets.filter((d) => {
        const matchSearch =
          !query ||
          d.title.toLowerCase().includes(query.toLowerCase()) ||
          d.description.toLowerCase().includes(query.toLowerCase());
        const matchTag = !activeTag || d.tags.includes(activeTag);
        return matchSearch && matchTag;
      }),
    [datasets, query, activeTag]
  );

  const retry = () => setFetchKey((k) => k + 1);

  return {
    datasets,
    filtered,
    query,
    setQuery,
    activeTag,
    setActiveTag,
    hasActiveFilters: Boolean(query || activeTag),
    isLoading,
    error,
    retry,
  };
}
