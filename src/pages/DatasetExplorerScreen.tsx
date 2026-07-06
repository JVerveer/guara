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

// Canonical filter keys match dataset.tags values (English).
// Display labels come from t(`datasets.tags.${key}`) so they're translated.
const FILTER_TAG_KEYS = ["Population", "Housing", "Economy", "Health", "Climate", "EU"] as const;

interface DatasetExplorerScreenProps {
  setScreen: (s: Screen) => void;
}

export function DatasetExplorerScreen({ setScreen }: DatasetExplorerScreenProps) {
  const { t } = useTranslation();
  const { formatCompact } = useLocale();
  const { filtered, query, setQuery, activeTag, setActiveTag, hasActiveFilters, isLoading, error, retry } =
    useDatasets();
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

  if (isLoading) return <LoadingState message={t("common.loading")} className="flex-1" />;

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

        {/* Tag filters */}
        <div className="flex items-center gap-2 mb-6 flex-wrap" role="group" aria-label="Filter by topic">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1" aria-hidden="true">
            <Filter size={11} /> {t("common.filter")}:
          </span>
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
                  : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {t(`datasets.tags.${tagKey}`)}
            </button>
          ))}
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
                <DatasetCard dataset={dataset} setScreen={setScreen} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
