import { ChevronRight, Database, ExternalLink, Hash, Table } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ProviderBadge } from "@/components/ui/ProviderBadge";
import { Tag } from "@/components/ui/Tag";
import type { Dataset } from "../types";
import type { Screen } from "@/types";

interface DatasetCardProps {
  dataset: Dataset;
  setScreen: (s: Screen) => void;
  setSelectedDatasetId?: (id: string) => void;
}

export function DatasetCard({ dataset: d, setScreen, setSelectedDatasetId }: DatasetCardProps) {
  const { t } = useTranslation();
  const years = d.qualification.yearStart && d.qualification.yearEnd
    ? d.qualification.yearStart === d.qualification.yearEnd
      ? String(d.qualification.yearStart)
      : `${d.qualification.yearStart}-${d.qualification.yearEnd}`
    : "Years unknown";
  const levels = d.qualification.geographicLevels.length > 0
    ? d.qualification.geographicLevels.map((level) => level === "neighborhood" ? "neighborhood" : level).join(", ")
    : "level unknown";
  const source = d.source;
  const sourceLoadedAt = source?.silverLoadedAt || source?.bronzeIngestedAt || source?.cbsUpdatedAt;
  const sourceLoadedLabel = sourceLoadedAt
    ? new Date(sourceLoadedAt).toLocaleDateString("en-US", { dateStyle: "medium" })
    : "unknown";

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <ProviderBadge name={d.provider} />
            <span className="text-[11px] text-muted-foreground">{d.updated}</span>
          </div>
          <h3 className="text-[14px] font-semibold text-foreground leading-snug">{d.title}</h3>
        </div>
        <ExternalLink size={13} className="text-muted-foreground flex-shrink-0 mt-1" />
      </div>

      <p className="text-[12.5px] text-muted-foreground leading-relaxed line-clamp-2">
        {d.description}
      </p>

      <div className="flex flex-wrap gap-1">
        {d.tags.map((tag) => (
          <Tag key={tag} label={t(`datasets.tags.${tag}`, { defaultValue: tag })} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">Years:</span> {years}
        </span>
        <span className="truncate" title={levels}>
          <span className="font-medium text-foreground">Level:</span> {levels}
        </span>
        <span>
          <span className="font-medium text-foreground">Records:</span> {d.recordCount?.toLocaleString("en-US") ?? d.records}
        </span>
        <span>
          <span className="font-medium text-foreground">Updated:</span> {d.updated}
        </span>
      </div>

      {source && (
        <div className="rounded-lg border border-border bg-background p-3 text-[11px] text-muted-foreground">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Database size={11} />
              {source.layer === "silver" ? "Silver dataset" : "Public catalog"}
            </span>
            {source.loadStatus && (
              <span className="rounded-md bg-accent px-1.5 py-0.5 font-medium text-accent-foreground">
                {source.loadStatus}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <span title={source.sourceUrl}>
              <span className="font-medium text-foreground">Original source:</span> {source.originalProvider}
            </span>
            <span>
              <span className="font-medium text-foreground">Loaded:</span> {sourceLoadedLabel}
            </span>
            {source.catalog && (
              <span className="truncate" title={source.catalog}>
                <span className="font-medium text-foreground">Catalog:</span> {source.catalog}
              </span>
            )}
            {source.language && (
              <span>
                <span className="font-medium text-foreground">Language:</span> {source.language}
              </span>
            )}
            {source.observationsLoaded !== undefined && (
              <span>
                <span className="font-medium text-foreground">Observations:</span> {source.observationsLoaded.toLocaleString("en-US")}
              </span>
            )}
            {source.measuresLoaded !== undefined && (
              <span>
                <span className="font-medium text-foreground">Measures:</span> {source.measuresLoaded.toLocaleString("en-US")}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Table size={10} />
            {d.records}
          </span>
          <span className="flex items-center gap-1">
            <Hash size={10} />
            {d.topics} {t("datasets.stats.topics").toLowerCase()}
          </span>
        </div>
        <button
          onClick={() => {
            setSelectedDatasetId?.(d.id);
            setScreen("dataset-detail");
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-primary hover:bg-accent transition-colors"
        >
          {t("datasets.exploreDataset")}
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
