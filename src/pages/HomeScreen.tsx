import { useState } from "react";
import { Search, ArrowUpRight, Database, Globe, Network } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { fonts } from "@/theme/tokens";
import type { Screen } from "@/types";

const EXAMPLE_QUESTION_KEYS = ["housing", "unemployment", "aging", "inequality"] as const;

interface HomeScreenProps {
  setScreen: (s: Screen) => void;
  setResearchQuestion: (question: string) => void;
}

export function HomeScreen({ setScreen, setResearchQuestion }: HomeScreenProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-16 bg-background">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <p className="text-[13px] font-semibold tracking-widest uppercase text-muted-foreground">
            {t("research.platformLabel")}
          </p>
          <h1
            className="text-4xl text-foreground tracking-tight"
            style={{ fontFamily: fonts.display, fontWeight: 400 }}
          >
            {t("research.heading")}
          </h1>
        </div>

        <div className="relative">
          <div className="relative flex items-center bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 focus-within:ring-2 focus-within:ring-primary/25 focus-within:border-primary/30">
            <Search size={17} className="absolute left-4 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  setResearchQuestion(query.trim());
                  setScreen("planning");
                }
              }}
              placeholder={t("research.searchPlaceholder")}
              className="w-full bg-transparent pl-11 pr-28 py-4 text-[15px] text-foreground placeholder:text-muted-foreground outline-none rounded-2xl"
            />
            <button
              onClick={() => {
                if (!query.trim()) return;
                setResearchQuestion(query.trim());
                setScreen("planning");
              }}
              className="absolute right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <ArrowUpRight size={13} />
              {t("research.searchButton")}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
            {t("research.tryAsking")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {EXAMPLE_QUESTION_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => {
                  const question = t(`research.exampleQuestions.${key}`);
                  setQuery(question);
                  setResearchQuestion(question);
                  setScreen("planning");
                }}
                className="flex items-start gap-2.5 text-left px-4 py-3 bg-card border border-border rounded-xl hover:bg-accent hover:border-primary/30 hover:text-accent-foreground transition-all duration-150 group"
              >
                <ArrowUpRight
                  size={13}
                  className={cn(
                    "flex-shrink-0 mt-0.5 text-muted-foreground transition-colors",
                    "group-hover:text-primary"
                  )}
                />
                <span className="text-sm text-muted-foreground leading-snug group-hover:text-foreground transition-colors">
                  {t(`research.exampleQuestions.${key}`)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-8 pt-2">
          {[
            { icon: <Database size={13} />, key: "research.quickAccess.datasets", target: "datasets" as Screen },
            { icon: <Globe size={13} />, key: "research.quickAccess.sources", target: "sources" as Screen },
            { icon: <Network size={13} />, key: "research.quickAccess.graph", target: "graph" as Screen },
          ].map(({ icon, key, target }) => (
            <button
              key={key}
              onClick={() => setScreen(target)}
              className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {icon}
              {t(key)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
