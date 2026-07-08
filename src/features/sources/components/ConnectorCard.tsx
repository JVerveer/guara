import { useTranslation } from "react-i18next";
import { useLocale } from "@/i18n/hooks/useLocale";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { Tag } from "@/components/ui/Tag";
import type { Connector } from "../types";

interface ConnectorCardProps {
  connector: Connector;
}

/**
 * Displays metadata for a single data Connector (CBS, KNMI, Kadaster, etc.).
 * Shows dataset count, coverage, last sync time, reliability, and domain tags.
 */
export function ConnectorCard({ connector: c }: ConnectorCardProps) {
  const { t } = useTranslation();
  const { formatNumber } = useLocale();

  return (
    <article
      aria-label={c.fullName}
      className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:shadow-md transition-shadow duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
            style={{ backgroundColor: c.brandColor }}
            aria-hidden="true"
          >
            {c.abbr}
          </div>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-foreground truncate">{c.name}</h3>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">{c.fullName}</p>
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full flex-shrink-0"
          style={{ color: "#16A34A", background: "#F0FDF4" }}
          aria-label="Status: Live"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
          {t("sources.live")}
        </div>
      </div>

      {/* Stats */}
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-[11px] text-muted-foreground">{t("sources.datasets")}</dt>
          <dd className="text-[15px] font-semibold text-foreground tabular-nums">
            {formatNumber(c.datasets)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">{t("sources.coverage")}</dt>
          <dd className="text-[13px] font-medium text-foreground truncate">{c.coverage}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">{t("sources.lastSynchronized")}</dt>
          <dd className="text-[13px] font-medium text-foreground">{c.lastSync}</dd>
        </div>
      </dl>

      {c.metadata && c.metadata.length > 0 && (
        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3">
          {c.metadata.map((item) => (
            <div key={item.label}>
              <dt className="text-[10px] text-muted-foreground">{item.label}</dt>
              <dd className="text-[12px] font-semibold text-foreground tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Reliability */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            {t("sources.reliability")}
          </p>
          <span className="text-[11px] font-semibold text-foreground tabular-nums">
            {c.reliability}%
          </span>
        </div>
        <ConfidenceBar value={c.reliability} />
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
        {c.tags.slice(0, 3).map((tag) => (
          <Tag key={tag} label={t(`datasets.tags.${tag}`, { defaultValue: tag })} />
        ))}
      </div>
    </article>
  );
}
