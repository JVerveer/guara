import { useEffect, useState } from "react";
import { datasetService } from "../services/datasetService";
import type { Dataset } from "../types";
import type { GeographicLevel } from "@/data/geography/types";

export type RecordCountFilter = "all" | "lt-1k" | "1k-100k" | "100k-plus";
export type UpdatedFilter = "all" | "last-year" | "last-5-years" | "older";

interface UseDatasetsResult {
  /** All datasets from the service */
  datasets: Dataset[];
  /** Datasets filtered by the current query + active tag */
  filtered: Dataset[];
  query: string;
  setQuery: (q: string) => void;
  activeTag: string | null;
  setActiveTag: (tag: string | null) => void;
  activeLevels: GeographicLevel[];
  setActiveLevels: (levels: GeographicLevel[]) => void;
  yearStart: string;
  setYearStart: (year: string) => void;
  yearEnd: string;
  setYearEnd: (year: string) => void;
  recordCountFilter: RecordCountFilter;
  setRecordCountFilter: (filter: RecordCountFilter) => void;
  updatedFilter: UpdatedFilter;
  setUpdatedFilter: (filter: UpdatedFilter) => void;
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
  const [remoteDatasets, setRemoteDatasets] = useState<Dataset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeLevels, setActiveLevels] = useState<GeographicLevel[]>([]);
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [recordCountFilter, setRecordCountFilter] = useState<RecordCountFilter>("all");
  const [updatedFilter, setUpdatedFilter] = useState<UpdatedFilter>("all");
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query), 350);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const tags = activeTag ? [activeTag] : [];

    datasetService
      .searchDatasets(debouncedQuery, tags)
      .then((data) => {
        if (!cancelled) setRemoteDatasets(data);
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
  }, [activeTag, fetchKey, debouncedQuery]);

  useEffect(() => {
    const minYear = Number(yearStart);
    const maxYear = Number(yearEnd);
    const now = Date.now();
    const yearMs = 365 * 24 * 60 * 60 * 1000;

    setDatasets(remoteDatasets.filter((dataset) => {
      const qualification = dataset.qualification;
      if (activeLevels.length > 0 && !activeLevels.some((level) => qualification.geographicLevels.includes(level))) {
        return false;
      }
      if (yearStart || yearEnd) {
        const lower = yearStart ? minYear : 1970;
        const upper = yearEnd ? maxYear : 2026;
        const matchesYears = qualification.years.length > 0
          ? qualification.years.some((year) => year >= lower && year <= upper)
          : qualification.yearStart !== undefined && qualification.yearEnd !== undefined && qualification.yearStart <= upper && qualification.yearEnd >= lower;
        if (!matchesYears) return false;
      }
      if (recordCountFilter !== "all") {
        const count = dataset.recordCount;
        if (count === undefined) return false;
        if (recordCountFilter === "lt-1k" && count >= 1_000) return false;
        if (recordCountFilter === "1k-100k" && (count < 1_000 || count > 100_000)) return false;
        if (recordCountFilter === "100k-plus" && count < 100_000) return false;
      }
      if (updatedFilter !== "all") {
        const updatedAt = dataset.updatedAt ? new Date(dataset.updatedAt).getTime() : Number.NaN;
        if (!Number.isFinite(updatedAt)) return false;
        if (updatedFilter === "last-year" && now - updatedAt > yearMs) return false;
        if (updatedFilter === "last-5-years" && now - updatedAt > yearMs * 5) return false;
        if (updatedFilter === "older" && now - updatedAt <= yearMs * 5) return false;
      }
      return true;
    }));
  }, [activeLevels, yearStart, yearEnd, recordCountFilter, updatedFilter, remoteDatasets]);

  const retry = () => setFetchKey((k) => k + 1);

  return {
    datasets,
    filtered: datasets,
    query,
    setQuery,
    activeTag,
    setActiveTag,
    activeLevels,
    setActiveLevels,
    yearStart,
    setYearStart,
    yearEnd,
    setYearEnd,
    recordCountFilter,
    setRecordCountFilter,
    updatedFilter,
    setUpdatedFilter,
    hasActiveFilters: Boolean(query || activeTag || activeLevels.length || yearStart || yearEnd || recordCountFilter !== "all" || updatedFilter !== "all"),
    isLoading,
    error,
    retry,
  };
}
