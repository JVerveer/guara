import { ArrowDown, ArrowRight, Database, Network, SearchCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { createResearchPlan } from "@/features/investigation/services/investigationService";
import type { ResearchPlan } from "@/features/investigation/types";
import { fonts } from "@/theme/tokens";
import type { Screen } from "@/types";

interface PlanningScreenProps {
  question: string;
  setScreen: (screen: Screen) => void;
  setResearchPlan: (plan: ResearchPlan) => void;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function PlanningScreen({ question, setScreen, setResearchPlan }: PlanningScreenProps) {
  const [plan, setPlan] = useState<ResearchPlan | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setPlan(null);

    createResearchPlan(question)
      .then((nextPlan) => {
        if (cancelled) return;
        setPlan(nextPlan);
        setResearchPlan(nextPlan);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      cancelled = true;
    };
  }, [fetchKey, question, setResearchPlan]);

  if (!question.trim()) {
    return (
      <ErrorState
        message="Start with an investigation question."
        onRetry={() => setScreen("home")}
        retryLabel="Back"
        className="flex-1"
      />
    );
  }

  if (error) {
    return <ErrorState message={error.message} onRetry={() => setFetchKey((key) => key + 1)} retryLabel="Retry" className="flex-1" />;
  }

  if (!plan) return <LoadingState message="Building research plan from Supabase silver tables..." className="flex-1" />;

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto max-w-5xl px-8 py-10">
        <header className="mb-8 flex items-start justify-between gap-6">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <SearchCheck size={14} aria-hidden="true" />
              Research Planning
            </p>
            <h1 className="max-w-3xl text-3xl leading-tight text-foreground" style={{ fontFamily: fonts.display, fontWeight: 400 }}>
              {plan.question}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setScreen("workspace")}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open Investigation Workspace
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </header>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-4">
          <Section title="Detected Entities">
            {plan.entities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No named municipalities, organizations or parties detected.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {plan.entities.map((entity) => (
                  <span key={entity.id} className="rounded-md bg-muted px-2.5 py-1 text-sm font-medium text-foreground">
                    {entity.label} · {entity.type}
                  </span>
                ))}
              </div>
            )}
          </Section>
          <div className="flex items-center justify-center text-muted-foreground"><ArrowDown size={16} /></div>
          <Section title="Detected Concepts">
            <div className="flex flex-wrap gap-2">
              {plan.concepts.map((concept) => (
                <span key={concept.id} className="rounded-md bg-accent px-2.5 py-1 text-sm font-medium text-accent-foreground">
                  {concept.label}
                </span>
              ))}
            </div>
          </Section>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <Section title="Possible Hypotheses">
            <ul className="space-y-2 text-sm text-foreground">
              {plan.hypotheses.map((hypothesis) => <li key={hypothesis}>{hypothesis}</li>)}
            </ul>
          </Section>
          <Section title="Expected Confidence">
            <div className="flex items-center gap-4">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${plan.expectedConfidence}%` }} />
              </div>
              <span className="text-lg font-semibold text-foreground">{plan.expectedConfidence}%</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Based on number and relevance of silver datasets found for this question.</p>
          </Section>
        </div>

        <Section title="Relevant Datasets" >
          <div className="space-y-3">
            {plan.datasets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching CBS datasets found. The workspace will record this as an evidence gap.</p>
            ) : plan.datasets.map(({ dataset, reason }) => (
              <article key={dataset.id} className="rounded-lg border border-border p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Database size={14} className="text-primary" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-foreground">{dataset.id} · {dataset.title}</h3>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{reason}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section title="Research Strategy">
          <ol className="space-y-2 text-sm text-foreground">
            {plan.strategy.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="text-muted-foreground">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Section>

        <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <Network size={15} aria-hidden="true" />
          The next workspace synchronizes evidence, map, graph, timeline and notebook selections from this plan.
        </div>
      </div>
    </div>
  );
}
