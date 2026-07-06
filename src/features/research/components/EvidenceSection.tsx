import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvidenceCard } from "./EvidenceCard";
import { researchService } from "../services/researchService";
import type { EvidenceSource } from "../types";
import type { Screen } from "@/types";

interface EvidenceSectionProps {
  setScreen: (s: Screen) => void;
}

export function EvidenceSection({ setScreen }: EvidenceSectionProps) {
  const { t } = useTranslation();
  const [sources, setSources] = useState<EvidenceSource[]>([]);

  useEffect(() => {
    let cancelled = false;
    researchService.getEvidenceSources().then((nextSources) => {
      if (!cancelled) setSources(nextSources);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {t("research.sourcesSection")}
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {sources.map((source) => (
          <EvidenceCard
            key={source.dataset}
            {...source}
            onViewDataset={() => setScreen("dataset-detail")}
          />
        ))}
      </div>
    </div>
  );
}
