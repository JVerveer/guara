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
    </div>
  );
}
