import { Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fonts } from "@/theme/tokens";

interface QuestionHeaderProps {
  question: string;
  sourceCount: number;
  confidenceScore: number;
}

export function QuestionHeader({ question, sourceCount, confidenceScore }: QuestionHeaderProps) {
  const { t } = useTranslation();

  return (
    <div>
      <h2
        className="text-2xl text-foreground leading-snug"
        style={{ fontFamily: fonts.display, fontWeight: 400 }}
      >
        {question}
      </h2>
      <div className="flex items-center gap-3 mt-2.5">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Activity size={11} />
          {t("research.sourcesAndConfidence", { count: sourceCount, confidence: confidenceScore })}
        </span>
        <span className="text-border">·</span>
        <span className="text-[11px] text-muted-foreground">
          {t("research.generatedJustNow")}
        </span>
      </div>
    </div>
  );
}
