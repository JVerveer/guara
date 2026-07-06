import { useTranslation } from "react-i18next";
import { EvidenceCard } from "./EvidenceCard";
import type { EvidenceSource } from "../types";
import type { Screen } from "@/types";

interface EvidenceSectionProps {
  setScreen: (s: Screen) => void;
  sources: EvidenceSource[];
}

export function EvidenceSection({ setScreen, sources }: EvidenceSectionProps) {
  const { t } = useTranslation();

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
