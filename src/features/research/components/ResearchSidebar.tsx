import { useEffect, useState } from "react";
import { Download, ExternalLink, Quote } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MiniGraph } from "@/features/graph/components/MiniGraph";
import { graphService } from "@/features/graph/services/graphService";
import { LoadingState } from "@/components/ui/LoadingState";
import type { MiniResearchGraph } from "@/features/graph/types";

const REFERENCES = [
  { n: 1, label: "CBS 70072NED", sub: "Regionale kerncijfers Nederland" },
  { n: 2, label: "CBS 85039NED", sub: "Kerncijfers wijken en buurten" },
] as const;

const ACTIONS = [
  { icon: <Download size={13} />, key: "research.exportReport" },
  { icon: <Quote size={13} />, key: "research.generateCitation" },
] as const;

export function ResearchSidebar() {
  const { t } = useTranslation();
  const [miniGraph, setMiniGraph] = useState<MiniResearchGraph | null>(null);

  useEffect(() => {
    graphService.getMiniGraph().then(setMiniGraph).catch(() => null);
  }, []);

  return (
    <aside
      aria-label="Research details"
      className="w-72 flex-shrink-0 border-l border-border bg-card overflow-y-auto"
    >
      <div className="p-5 space-y-5">
        {/* Mini graph */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
              {t("research.researchGraph")}
            </h2>
            <button
              type="button"
              aria-label="Open full graph"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink size={12} aria-hidden="true" />
            </button>
          </div>
          <div
            className="rounded-xl border border-border overflow-hidden bg-background"
            style={{ height: 200 }}
          >
            {miniGraph ? (
              <MiniGraph graph={miniGraph} />
            ) : (
              <LoadingState className="py-8" />
            )}
          </div>
        </div>

        {/* References */}
        <section aria-label="References">
          <h2 className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-3">
            {t("research.references")}
          </h2>
          <ol className="space-y-1 list-none">
            {REFERENCES.map(({ n, label, sub }) => (
              <li key={n} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-muted transition-colors">
                <span className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-semibold text-primary bg-accent mt-0.5">
                  {n}
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-foreground leading-tight">{label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Actions */}
        <div className="space-y-2">
          {ACTIONS.map(({ icon, key }) => (
            <button
              key={key}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <span aria-hidden="true">{icon}</span>
              {t(key)}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
