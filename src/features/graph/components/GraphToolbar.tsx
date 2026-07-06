import { useTranslation } from "react-i18next";
import { useLocale } from "@/i18n/hooks/useLocale";
import { cn } from "@/lib/utils";

export const FILTER_KEYS = ["all", "economy", "society", "environment"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  totalDatasets: number;
}

interface GraphToolbarProps {
  activeFilter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
  stats: GraphStats;
}

export function GraphToolbar({ activeFilter, onFilterChange, stats }: GraphToolbarProps) {
  const { t } = useTranslation();
  const { formatNumber } = useLocale();

  return (
    <div className="h-11 flex items-center justify-between px-5 border-b border-border bg-card flex-shrink-0">
      <div className="flex items-center gap-4 min-w-0">
        <h1 className="text-[13px] font-semibold text-foreground flex-shrink-0">
          {t("graph.title")}
        </h1>
        <p className="text-[11px] text-muted-foreground truncate" aria-live="polite">
          {t("graph.statsDescription", {
            topics: formatNumber(stats.nodeCount),
            connections: formatNumber(stats.edgeCount),
            datasets: formatNumber(stats.totalDatasets),
          })}
        </p>
      </div>

      <div
        className="flex items-center gap-1.5 flex-shrink-0"
        role="group"
        aria-label="Filter graph by domain"
      >
        {FILTER_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onFilterChange(key)}
            aria-pressed={activeFilter === key}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
              activeFilter === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {t(`graph.filters.${key}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
