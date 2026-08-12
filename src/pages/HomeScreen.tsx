import { useEffect, useState } from "react";
import { Search, ArrowUpRight, Database, Globe, GitMerge, Layers3, Lightbulb, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { fonts } from "@/theme/tokens";
import type { Screen } from "@/types";
import { goldCapabilityGuideService, type GoldCapabilityGuide } from "@/features/semantic/services/goldCapabilityGuideService";
import { semanticSearchService } from "@/features/semantic/services/semanticSearchService";
import type { SemanticAnswer } from "@/features/semantic/types";

interface HomeScreenProps {
  setScreen: (s: Screen) => void;
  setResearchQuestion: (question: string) => void;
}

const EMPTY_GUIDE: GoldCapabilityGuide = {
  domains: [],
  metrics: [],
  questionStarters: [],
  combinations: [],
  recipes: [],
  answerTypes: [],
  isLive: false,
  error: null,
};

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function yearRange(minYear: number | null, maxYear: number | null): string {
  if (minYear && maxYear) return minYear === maxYear ? String(maxYear) : `${minYear}-${maxYear}`;
  return "Years depend on metric";
}

function levelLabel(level: string): string {
  if (level === "municipality") return "Municipality";
  if (level === "province") return "Province";
  if (level === "country" || level === "national") return "National";
  if (level === "region") return "Region";
  return level.replaceAll("_", " ");
}

export function HomeScreen({ setScreen, setResearchQuestion }: HomeScreenProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [guide, setGuide] = useState<GoldCapabilityGuide>(EMPTY_GUIDE);
  const [isGuideLoading, setIsGuideLoading] = useState(true);
  const [preview, setPreview] = useState<SemanticAnswer | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsGuideLoading(true);
    goldCapabilityGuideService.getGuide().then((nextGuide) => {
      if (!cancelled) {
        setGuide(nextGuide);
        setIsGuideLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startQuestion = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setResearchQuestion(trimmed);
    setScreen("result");
  };

  const checkQuestion = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsPreviewLoading(true);
    setPreview(null);
    try {
      setPreview(await semanticSearchService.answer(trimmed));
    } finally {
      setIsPreviewLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-6xl space-y-8">
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

        <div className="relative mx-auto max-w-3xl">
          <div className="relative flex items-center bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 focus-within:ring-2 focus-within:ring-primary/25 focus-within:border-primary/30">
            <Search size={17} className="absolute left-4 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  startQuestion(query);
                }
              }}
              placeholder={t("research.searchPlaceholder")}
              className="w-full bg-transparent pl-11 pr-44 py-4 text-[15px] text-foreground placeholder:text-muted-foreground outline-none rounded-2xl"
            />
            <button
              onClick={checkQuestion}
              disabled={!query.trim() || isPreviewLoading}
              className="absolute right-24 flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPreviewLoading ? <RefreshCw size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
              Check
            </button>
            <button
              onClick={() => {
                startQuestion(query);
              }}
              className="absolute right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <ArrowUpRight size={13} />
              {t("research.searchButton")}
            </button>
          </div>
        </div>

        {preview && (
          <section className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Interpretation preview</p>
                <h2 className="mt-1 text-sm font-semibold text-foreground">{preview.title}</h2>
              </div>
              <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{preview.confidence}% confidence</span>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <p><span className="font-medium text-foreground">Source:</span> {preview.queryPlan.source.replaceAll("_", " ")}</p>
              <p><span className="font-medium text-foreground">Question type:</span> {preview.intent.replaceAll("_", " ")}</p>
              <p><span className="font-medium text-foreground">Metric:</span> {preview.queryPlan.measure_label ?? preview.queryPlan.metric_code ?? "multiple metrics"}</p>
              <p><span className="font-medium text-foreground">Grain:</span> {preview.queryPlan.grain?.display_grain ?? "selected Gold grain"}</p>
              <p><span className="font-medium text-foreground">Dataset:</span> {preview.queryPlan.dataset_code ?? "selected Gold dataset"}</p>
              <p><span className="font-medium text-foreground">Period:</span> {preview.queryPlan.year ?? (preview.queryPlan.year_start && preview.queryPlan.year_end ? `${preview.queryPlan.year_start}-${preview.queryPlan.year_end}` : "latest/selected")}</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{preview.summary}</p>
          </section>
        )}

        <section className="grid gap-3 md:grid-cols-2">
          {(isGuideLoading ? [] : guide.domains).map((domain) => (
            <article key={domain.domainId} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gold domain</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">{domain.title}</h2>
                </div>
                <Layers3 size={18} className="text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{domain.description}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-md bg-muted p-2"><p className="text-xs text-muted-foreground">Datasets</p><p className="font-semibold text-foreground">{domain.datasetCount}</p></div>
                <div className="rounded-md bg-muted p-2"><p className="text-xs text-muted-foreground">Metrics</p><p className="font-semibold text-foreground">{domain.metricCount}</p></div>
                <div className="rounded-md bg-muted p-2"><p className="text-xs text-muted-foreground">Facts</p><p className="font-semibold text-foreground">{formatCompact(domain.factRows)}</p></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{yearRange(domain.minYear, domain.maxYear)}</span>
                {domain.geographyTypes.slice(0, 4).map((level) => (
                  <span key={level} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{levelLabel(level)}</span>
                ))}
              </div>
            </article>
          ))}
          {!isGuideLoading && guide.domains.length === 0 && (
            <article className="rounded-lg border border-border bg-card p-5 md:col-span-2">
              <h2 className="text-lg font-semibold text-foreground">Gold capability metadata is not available</h2>
              <p className="mt-2 text-sm text-muted-foreground">{guide.error ?? "Run the Gold capability loader and semantic model loaders to populate this guide."}</p>
            </article>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Question starters</p>
              <h2 className="text-lg font-semibold text-foreground">Questions Guara can route through Gold</h2>
            </div>
            <Sparkles size={18} className="text-muted-foreground" />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {guide.questionStarters.map((starter) => (
              <button
                key={starter.question}
                onClick={() => startQuestion(starter.question)}
                className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-accent"
              >
                <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                <span>
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{starter.label} · {starter.grain?.replace("_", "-") ?? "Gold grain"}</span>
                  <span className="mt-1 block text-sm leading-6 text-foreground">{starter.question}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <GitMerge size={17} className="text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Safe combinations</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {guide.combinations.slice(0, 4).map((combination) => (
                <article key={combination.question} className="rounded-lg border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground">{combination.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{combination.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{combination.sharedGrain.replace("_", "-")}</span>
                    {combination.datasets.map((dataset) => <span key={dataset} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{dataset}</span>)}
                  </div>
                  <button onClick={() => startQuestion(combination.question)} className="mt-4 text-sm font-medium text-foreground hover:text-primary">
                    Ask this question
                  </button>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb size={17} className="text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Research recipes</h2>
            </div>
            {guide.recipes.map((recipe) => (
              <article key={recipe.title} className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground">{recipe.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{recipe.description}</p>
                <ol className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {recipe.steps.map((step, index) => <li key={step}>{index + 1}. {step}</li>)}
                </ol>
                <button onClick={() => startQuestion(recipe.starterQuestion)} className="mt-4 text-sm font-medium text-foreground hover:text-primary">
                  Start recipe
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">Answer types currently supported</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {guide.answerTypes.map((type) => (
              <button key={type.kind} onClick={() => setQuery(type.example)} className="rounded-md border border-border p-3 text-left transition-colors hover:bg-muted">
                <p className="text-sm font-semibold text-foreground">{type.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{type.description}</p>
              </button>
            ))}
          </div>
        </section>

        <div className="flex items-center justify-center gap-8 pt-2">
          {[
            { icon: <Database size={13} />, key: "research.quickAccess.datasets", target: "datasets" as Screen },
            { icon: <Globe size={13} />, key: "research.quickAccess.sources", target: "sources" as Screen },
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
