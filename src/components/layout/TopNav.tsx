import { Search, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Screen } from "@/types";

interface TopNavProps {
  screen: Screen;
  setScreen: (s: Screen) => void;
}

export function TopNav({ screen, setScreen }: TopNavProps) {
  const { t } = useTranslation();

  const SCREEN_LABELS: Record<Screen, string> = {
    home: "",
    planning: "Research plan",
    workspace: "Investigation Workspace",
    result: t("research.resultHeading"),
    datasets: t("nav.datasetExplorer"),
    sources: t("nav.sourceBrowser"),
    map: t("nav.mapExplorer"),
    graph: t("graph.title"),
    "dataset-detail": t("datasets.tabs.metadata"),
  };

  const label = SCREEN_LABELS[screen];

  return (
    <header className="h-12 flex items-center px-5 gap-4 border-b border-border bg-card flex-shrink-0">
      <div className="flex-1 min-w-0">
        {screen !== "home" && label && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <button
              onClick={() => setScreen("home")}
              className="hover:text-foreground transition-colors flex-shrink-0"
            >
              {t("nav.guara")}
            </button>
            <ChevronRight size={12} className="flex-shrink-0" />
            <span className="text-foreground font-medium truncate">{label}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/70 transition-colors text-sm text-muted-foreground">
          <Search size={13} />
          <span className="text-[12px] hidden sm:block">{t("common.searchEverything")}</span>
          <kbd className="text-[10px] px-1 py-0.5 rounded bg-card border border-border font-mono hidden sm:block">
            {t("common.shortcutHint")}
          </kbd>
        </button>

        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold flex-shrink-0">
          ML
        </div>
      </div>
    </header>
  );
}
