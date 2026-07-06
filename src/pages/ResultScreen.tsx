import { useTranslation } from "react-i18next";
import { useResearchQuery } from "@/features/research/hooks/useResearchQuery";
import { QuestionHeader } from "@/features/research/components/QuestionHeader";
import { AnswerBlock } from "@/features/research/components/AnswerBlock";
import { EvidenceSection } from "@/features/research/components/EvidenceSection";
import { HousePricesChart } from "@/features/research/components/HousePricesChart";
import { AgingChart } from "@/features/research/components/AgingChart";
import { FollowUpQuestions } from "@/features/research/components/FollowUpQuestions";
import { ResearchSidebar } from "@/features/research/components/ResearchSidebar";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Screen } from "@/types";

interface ResultScreenProps {
  setScreen: (s: Screen) => void;
}

export function ResultScreen({ setScreen }: ResultScreenProps) {
  const { t } = useTranslation();
  const { result, isLoading, error, retry } = useResearchQuery();

  if (isLoading) {
    return <LoadingState message={t("common.loading")} className="flex-1" />;
  }

  if (error) {
    return (
      <ErrorState
        message={error.message}
        onRetry={retry}
        retryLabel={t("errors.retry")}
        className="flex-1"
      />
    );
  }

  if (!result) {
    return (
      <EmptyState
        title={t("research.emptyState.title")}
        description={t("research.emptyState.description")}
        className="flex-1"
      />
    );
  }

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <main className="max-w-3xl mx-auto px-8 py-10 space-y-10">
          <QuestionHeader
            sourceCount={result.sourceCount}
            confidenceScore={result.confidenceScore}
          />
          <AnswerBlock />
          <EvidenceSection setScreen={setScreen} />
          <div className="space-y-6">
            <HousePricesChart />
            <AgingChart />
          </div>
          <FollowUpQuestions />
          <div className="pb-8" aria-hidden="true" />
        </main>
      </div>
      <ResearchSidebar />
    </div>
  );
}
