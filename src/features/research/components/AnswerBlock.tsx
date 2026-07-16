import type { ResearchQuery } from "../types";

interface AnswerBlockProps {
  result: ResearchQuery;
}

export function AnswerBlock({ result }: AnswerBlockProps) {
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
    </div>
  );
}
