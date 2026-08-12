import type { Screen } from "@/types";
import { HomeScreen } from "@/pages/HomeScreen";
import { ResultScreen } from "@/pages/ResultScreen";
import { DatasetExplorerScreen } from "@/pages/DatasetExplorerScreen";
import { SourceBrowserScreen } from "@/pages/SourceBrowserScreen";
import { DatasetDetailScreen } from "@/pages/DatasetDetailScreen";
import { PlanningScreen } from "@/pages/PlanningScreen";
import { InvestigationWorkspaceScreen } from "@/pages/InvestigationWorkspaceScreen";
import { SemanticWorkbenchScreen } from "@/pages/SemanticWorkbenchScreen";
import type { ResearchPlan } from "@/features/investigation/types";

interface RouteProps {
  setScreen: (s: Screen) => void;
}

export interface RouteState {
  selectedDatasetId: string;
  setSelectedDatasetId: (id: string) => void;
  researchQuestion: string;
  setResearchQuestion: (question: string) => void;
  researchPlan: ResearchPlan | null;
  setResearchPlan: (plan: ResearchPlan) => void;
}

/**
 * Renders the active screen based on the current navigation state.
 * Replaces a router for this single-page app.
 * Swap for react-router or TanStack Router when adding URL-based routing.
 */
export function renderRoute(screen: Screen, setScreen: (s: Screen) => void, state: RouteState): React.ReactNode {
  const props: RouteProps = { setScreen };

  switch (screen) {
    case "home":
      return <HomeScreen {...props} setResearchQuestion={state.setResearchQuestion} />;
    case "planning":
      return (
        <PlanningScreen
          question={state.researchQuestion}
          setScreen={setScreen}
          setResearchPlan={state.setResearchPlan}
        />
      );
    case "workspace":
      return <InvestigationWorkspaceScreen plan={state.researchPlan} setScreen={setScreen} />;
    case "result":
      return (
        <ResultScreen
          {...props}
          question={state.researchQuestion}
          setResearchQuestion={state.setResearchQuestion}
          setResearchPlan={state.setResearchPlan}
        />
      );
    case "datasets":
      return <DatasetExplorerScreen {...props} setSelectedDatasetId={state.setSelectedDatasetId} />;
    case "sources":
      return <SourceBrowserScreen />;
    case "semantic-workbench":
      return <SemanticWorkbenchScreen />;
    case "dataset-detail":
      return <DatasetDetailScreen datasetId={state.selectedDatasetId} />;
  }
}
