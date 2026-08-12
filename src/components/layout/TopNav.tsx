import { Check, ChevronRight, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Screen } from "@/types";

interface TopNavProps {
  screen: Screen;
  setScreen: (s: Screen) => void;
  researchTitle?: string;
  onRenameResearchTitle?: (title: string) => void;
}

export function TopNav({ screen, setScreen, researchTitle, onRenameResearchTitle }: TopNavProps) {
  const { t } = useTranslation();
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(researchTitle ?? "");

  const SCREEN_LABELS: Record<Screen, string> = {
    home: "",
    planning: "Research plan",
    workspace: researchTitle?.trim() || "Untitled investigation",
    result: t("research.resultHeading"),
    datasets: t("nav.datasetExplorer"),
    sources: t("nav.sourceBrowser"),
    "semantic-workbench": "Semantic Workbench",
    "dataset-detail": t("datasets.tabs.metadata"),
  };

  const label = SCREEN_LABELS[screen];
  const canRename = screen === "workspace" && Boolean(onRenameResearchTitle);

  useEffect(() => {
    setDraftTitle(researchTitle ?? "");
  }, [researchTitle]);

  const saveTitle = () => {
    const nextTitle = draftTitle.trim() || "Untitled investigation";
    onRenameResearchTitle?.(nextTitle);
    setDraftTitle(nextTitle);
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setDraftTitle(researchTitle ?? "");
    setIsRenaming(false);
  };

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
            {canRename && isRenaming ? (
              <form
                className="flex min-w-0 items-center gap-1.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveTitle();
                }}
              >
                <input
                  autoFocus
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") cancelRename();
                  }}
                  className="h-7 min-w-[18rem] max-w-[42rem] rounded-md border border-border bg-background px-2.5 text-sm font-medium text-foreground outline-none transition focus:border-primary"
                />
                <button
                  type="submit"
                  aria-label="Save title"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Cancel rename"
                  onClick={cancelRename}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </form>
            ) : (
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium text-foreground">{label}</span>
                {canRename && (
                  <button
                    type="button"
                    aria-label="Rename investigation"
                    onClick={() => setIsRenaming(true)}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold flex-shrink-0">
          ML
        </div>
      </div>
    </header>
  );
}
