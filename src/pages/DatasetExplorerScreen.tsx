import { Search, Filter } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocale } from "@/i18n/hooks/useLocale";
import { fonts } from "@/theme/tokens";
import { cn } from "@/lib/utils";
import { DatasetCard } from "@/features/datasets/components/DatasetCard";
import { useDatasets } from "@/features/datasets/hooks/useDatasets";
import { connectorService } from "@/features/sources/services/connectorService";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Screen } from "@/types";
import type { GeographicLevel } from "@/data/geography/types";

// Canonical filter keys match dataset.tags values (English).
// Display labels come from t(`datasets.tags.${key}`) so they're translated.
const FILTER_TAG_KEYS = ["Silver", "Population", "Housing", "Economy", "Health", "Climate", "EU"] as const;
const LEVEL_FILTERS: Array<{ key: GeographicLevel; label: string }> = [
  { key: "neighborhood", label: "Neighborhood" },
  { key: "municipality", label: "Municipality" },
  { key: "province", label: "Province" },
  { key: "country", label: "Country" },
];

interface DatasetExplorerScreenProps {
  setScreen: (s: Screen) => void;
  setSelectedDatasetId: (id: string) => void;
}

export function DatasetExplorerScreen({ setScreen, setSelectedDatasetId }: DatasetExplorerScreenProps) {
  const { t } = useTranslation();
  const { formatCompact } = useLocale();
  const {
    filtered,
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
    hasActiveFilters,
    isLoading,
    error,
    retry,
  } = useDatasets();
  const [catalogStats, setCatalogStats] = useState({ totalDatasets: 0, sourceCount: 0 });

  useEffect(() => {
    let cancelled = false;

    Promise.all([connectorService.getTotalDatasetCount(), connectorService.getConnectorCount()]).then(
      ([totalDatasets, sourceCount]) => {
        if (!cancelled) setCatalogStats({ totalDatasets, sourceCount });
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading && filtered.length === 0 && !query) return <LoadingState message={t("common.loading")} className="flex-1" />;

  if (error) {
    return (
      <ErrorState
        message={error.message}
        onRetry={retry}
        retryLabel={t("errors.retry")}
        className="flex-1"
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-8 py-10">
        <header className="mb-8">
          <h1
            className="text-3xl text-foreground mb-1"
            style={{ fontFamily: fonts.display, fontWeight: 400 }}
          >
            {t("datasets.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("datasets.browseDescription", {
              total: formatCompact(catalogStats.totalDatasets),
              sources: catalogStats.sourceCount,
            })}
          </p>
        </header>

        {/* Search */}
        <div className="relative mb-5">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <label htmlFor="dataset-search" className="sr-only">
            {t("datasets.searchPlaceholder")}
          </label>
          <input
            id="dataset-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("datasets.searchPlaceholder")}
            className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/30 transition-all"
          />
        </div>

        {/* Qualification filters */}
        <div className="mb-6 space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <Filter size={12} /> Dataset qualifiers
            {isLoading && <span className="normal-case tracking-normal">Refreshing…</span>}
          </div>

          <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter by topic">
            {FILTER_TAG_KEYS.map((tagKey) => (
              <button
                key={tagKey}
                type="button"
                onClick={() => setActiveTag(activeTag === tagKey ? null : tagKey)}
                aria-pressed={activeTag === tagKey}
                className={cn(
                  "px-3 py-1 rounded-full text-[12px] font-medium border transition-all duration-150",
                  activeTag === tagKey
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {t(`datasets.tags.${tagKey}`, { defaultValue: tagKey })}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-[1.1fr_1fr_1fr] gap-3">
            <div>
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">Level</p>
              <div className="flex flex-wrap gap-2">
                {LEVEL_FILTERS.map((level) => {
                  const active = activeLevels.includes(level.key);
                  return (
                    <button
                      key={level.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setActiveLevels(active ? activeLevels.filter((item) => item !== level.key) : [...activeLevels, level.key])
                      }
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {level.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">Years</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1970}
                  max={2026}
                  value={yearStart}
                  onChange={(event) => setYearStart(event.target.value)}
                  placeholder="1970"
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1970}
                  max={2026}
                  value={yearEnd}
                  onChange={(event) => setYearEnd(event.target.value)}
                  placeholder="2026"
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-medium text-muted-foreground">
                Record count
                <select
                  value={recordCountFilter}
                  onChange={(event) => setRecordCountFilter(event.target.value as typeof recordCountFilter)}
                  className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">Any</option>
                  <option value="lt-1k">Under 1K</option>
                  <option value="1k-100k">1K-100K</option>
                  <option value="100k-plus">100K+</option>
                </select>
              </label>
              <label className="text-[11px] font-medium text-muted-foreground">
                Last updated
                <select
                  value={updatedFilter}
                  onChange={(event) => setUpdatedFilter(event.target.value as typeof updatedFilter)}
                  className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">Any</option>
                  <option value="last-year">Last year</option>
                  <option value="last-5-years">Last 5 years</option>
                  <option value="older">Older</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {/* Results count */}
        {hasActiveFilters && (
          <p className="text-xs text-muted-foreground mb-4" aria-live="polite" aria-atomic="true">
            {t("datasets.resultsCount", { count: filtered.length })}
          </p>
        )}

        {/* Dataset grid */}
        {filtered.length === 0 ? (
          <EmptyState title={t("errors.noDatasets")} />
        ) : (
          <ul className="grid grid-cols-2 gap-4 list-none">
            {filtered.map((dataset) => (
              <li key={dataset.id}>
                <DatasetCard dataset={dataset} setScreen={setScreen} setSelectedDatasetId={setSelectedDatasetId} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
