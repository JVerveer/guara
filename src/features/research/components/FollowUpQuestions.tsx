import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export function FollowUpQuestions() {
  const { t } = useTranslation();
  const questions = t("research.followUpQuestions", { returnObjects: true }) as string[];

  return (
    <div>
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {t("research.exploreFurther")}
      </h3>
      <div className="space-y-2">
        {questions.map((question, i) => (
          <button
            key={i}
            className="w-full flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl text-left text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-accent/40 transition-all duration-150 group"
          >
            <ArrowUpRight
              size={13}
              className="flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
            />
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
