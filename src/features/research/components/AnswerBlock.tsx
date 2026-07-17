import type { ResearchQuery } from "../types";

interface AnswerBlockProps {
  result: ResearchQuery;
  onOpenWorkspace?: () => void;
  onAskFollowUp?: (question: string) => void;
}

export function AnswerBlock({ result, onOpenWorkspace, onAskFollowUp }: AnswerBlockProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{result.answerTitle}</h3>
        <p className="mt-2 text-[15px] leading-7 text-muted-foreground">{result.answerSummary}</p>
      </div>

      {result.answerBullets.length > 0 && (
        <ul className="space-y-2 border-l-2 border-accent pl-4">
          {result.answerBullets.map((item) => (
            <li key={item} className="text-[14px] leading-6 text-foreground">
              {item}
            </li>
          ))}
        </ul>
      )}

      {(result.intent || result.answerId || result.provenance?.length) && (
        <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
          <div className="mb-2 flex flex-wrap gap-2">
            {result.intent && <span className="rounded-md bg-muted px-2 py-1">Intent: {result.intent}</span>}
            {result.answerId && <span className="rounded-md bg-muted px-2 py-1">Answer ID: {result.answerId}</span>}
          </div>
          {result.provenance?.length ? (
            <ol className="list-decimal space-y-1 pl-4">
              {result.provenance.map((step) => <li key={step}>{step}</li>)}
            </ol>
          ) : null}
        </div>
      )}

      {(result.caveats?.length ?? 0) > 0 && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h4 className="text-sm font-semibold text-foreground">Caveats</h4>
          <ul className="mt-3 space-y-2">
            {result.caveats?.map((caveat) => (
              <li key={`${caveat.severity}:${caveat.message}`} className="text-sm leading-6 text-muted-foreground">
                <span className="mr-2 rounded-md bg-muted px-2 py-1 text-[11px] uppercase tracking-wide text-foreground">{caveat.severity}</span>
                {caveat.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(result.relatedDatasets?.length ?? 0) > 0 && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h4 className="text-sm font-semibold text-foreground">Related Datasets</h4>
          <div className="mt-3 space-y-3">
            {result.relatedDatasets?.map((dataset) => (
              <article key={dataset.datasetCode} className="border-l-2 border-border pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{dataset.title}</span>
                  <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">{dataset.datasetCode}</span>
                  <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">{dataset.relationship}</span>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{dataset.reason}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {(result.followUpQuestions?.length ?? 0) > 0 && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h4 className="text-sm font-semibold text-foreground">Follow-Up Questions</h4>
          <div className="mt-3 space-y-3">
            {result.followUpQuestions?.map((followUp) => (
              <article key={followUp.question} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{followUp.label}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{followUp.question}</p>
                  </div>
                  <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                    {followUp.status === "answerable_now" ? "Answerable now" : "Needs more data"}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{followUp.reason}</p>
                {onAskFollowUp && followUp.status === "answerable_now" && (
                  <button
                    type="button"
                    onClick={() => onAskFollowUp(followUp.question)}
                    className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Ask this
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {result.workspaceHandoff && onOpenWorkspace && (
        <section className="rounded-lg border border-accent/40 bg-accent/5 p-4">
          <h4 className="text-sm font-semibold text-foreground">Continue Investigation</h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Open the Investigation Workspace with this answer, related datasets, caveats and suggested next paths.
          </p>
          <button
            type="button"
            onClick={onOpenWorkspace}
            className="mt-3 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Open Investigation Workspace
          </button>
        </section>
      )}
    </div>
  );
}
