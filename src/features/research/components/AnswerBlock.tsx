import { Trans, useTranslation } from "react-i18next";

const ANSWER_POINTS = [
  { titleKey: "research.answer.supplyTitle", bodyKey: "research.answer.supplyBody", cite: 2 },
  { titleKey: "research.answer.accessTitle", bodyKey: "research.answer.accessBody", cite: 3 },
  { titleKey: "research.answer.incomeTitle", bodyKey: "research.answer.incomeBody", cite: 1 },
] as const;

export function AnswerBlock() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <p className="text-[16.5px] leading-8 text-foreground">
        <Trans
          i18nKey="research.answer.intro"
          components={{
            bold: <span className="font-semibold" />,
            cite: (
              <sup className="text-primary text-[10px] ml-0.5 cursor-pointer font-medium" />
            ),
          }}
        />
      </p>

      <div className="space-y-4 pl-4 border-l-2 border-accent">
        {ANSWER_POINTS.map(({ titleKey, bodyKey, cite }) => (
          <div key={titleKey}>
            <p className="text-[15px] leading-7 text-foreground">
              <span className="font-semibold">{t(titleKey)}</span>{" "}
              <span className="text-muted-foreground">
                {t(bodyKey)}
                <sup className="text-primary text-[10px] ml-0.5 cursor-pointer font-medium">
                  [{cite}]
                </sup>
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
