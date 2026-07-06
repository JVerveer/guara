import type { Screen } from "@/types";
import { HomeScreen } from "@/pages/HomeScreen";
import { ResultScreen } from "@/pages/ResultScreen";
import { DatasetExplorerScreen } from "@/pages/DatasetExplorerScreen";
import { SourceBrowserScreen } from "@/pages/SourceBrowserScreen";
import { GraphScreen } from "@/pages/GraphScreen";
import { DatasetDetailScreen } from "@/pages/DatasetDetailScreen";
import { MapExplorerScreen } from "@/pages/MapExplorerScreen";

interface RouteProps {
  setScreen: (s: Screen) => void;
}

export interface RouteState {
  selectedDatasetId: string;
  setSelectedDatasetId: (id: string) => void;
  researchQuestion: string;
  setResearchQuestion: (question: string) => void;
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
    case "result":
      return <ResultScreen {...props} question={state.researchQuestion} />;
    case "datasets":
      return <DatasetExplorerScreen {...props} setSelectedDatasetId={state.setSelectedDatasetId} />;
    case "sources":
      return <SourceBrowserScreen />;
    case "map":
      return <MapExplorerScreen />;
    case "graph":
      return <GraphScreen />;
    case "dataset-detail":
      return <DatasetDetailScreen datasetId={state.selectedDatasetId} />;
  }
}
