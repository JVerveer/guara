import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ProviderBadge } from "@/components/ui/ProviderBadge";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { Tag } from "@/components/ui/Tag";
import type { EvidenceSource } from "../types";

interface EvidenceCardProps extends EvidenceSource {
  onViewDataset?: () => void;
}

export function EvidenceCard({
  provider,
  dataset,
  confidence,
  variables,
  onViewDataset,
}: EvidenceCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 flex-1 min-w-0">
          <ProviderBadge name={provider} />
          <p className="text-sm font-medium text-foreground leading-tight">{dataset}</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 flex-shrink-0"
          aria-label={expanded ? t("common.collapse") : t("common.expand")}
        >
          <ChevronDown
            size={14}
            className={cn("transition-transform duration-200", expanded && "rotate-180")}
          />
        </button>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {t("research.confidence")}
        </p>
        <ConfidenceBar value={confidence} />
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {t("research.usedVariables")}
        </p>
        <div className="flex flex-wrap gap-1">
          {variables.map((v) => (
            <Tag key={v} label={v} />
          ))}
        </div>
      </div>

      {expanded && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("research.evidenceDescription")}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-border flex-wrap">
        <button
          onClick={onViewDataset}
          className="text-[11px] font-medium text-primary hover:opacity-70 transition-opacity"
        >
          {t("datasets.viewDataset")}
        </button>
        <span className="text-muted-foreground/40">·</span>
        <button className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          {t("common.metadata")}
        </button>
        <span className="text-muted-foreground/40">·</span>
        <button className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          {t("common.openApi")}
        </button>
        <span className="text-muted-foreground/40">·</span>
        <button className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          {t("common.citation")}
        </button>
      </div>
    </div>
  );
}
