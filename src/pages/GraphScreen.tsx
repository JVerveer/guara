import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useResearchGraph } from "@/features/graph/hooks/useResearchGraph";
import { KnowledgeGraph } from "@/features/graph/components/KnowledgeGraph";
import { GraphToolbar, type FilterKey } from "@/features/graph/components/GraphToolbar";
import { GraphLegend, GraphHint } from "@/features/graph/components/GraphLegend";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";

export function GraphScreen() {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const { graph, stats, isLoading, error, retry } = useResearchGraph();

  if (isLoading) return <LoadingState message={t("common.loading")} className="flex-1" />;

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

  if (!graph) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <GraphToolbar
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        stats={stats}
      />
      <div className="flex-1 relative overflow-hidden bg-background">
        <div className="absolute inset-0" aria-hidden="true">
          <KnowledgeGraph graph={graph} />
        </div>
        <GraphLegend />
        <GraphHint />
      </div>
    </div>
  );
}
