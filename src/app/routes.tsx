import type { Screen } from "@/types";
import { HomeScreen } from "@/pages/HomeScreen";
import { ResultScreen } from "@/pages/ResultScreen";
import { DatasetExplorerScreen } from "@/pages/DatasetExplorerScreen";
import { SourceBrowserScreen } from "@/pages/SourceBrowserScreen";
import { GraphScreen } from "@/pages/GraphScreen";
import { DatasetDetailScreen } from "@/pages/DatasetDetailScreen";

interface RouteProps {
  setScreen: (s: Screen) => void;
}

/**
 * Renders the active screen based on the current navigation state.
 * Replaces a router for this single-page app.
 * Swap for react-router or TanStack Router when adding URL-based routing.
 */
export function renderRoute(screen: Screen, setScreen: (s: Screen) => void): React.ReactNode {
  const props: RouteProps = { setScreen };

  switch (screen) {
    case "home":
      return <HomeScreen {...props} />;
    case "result":
      return <ResultScreen {...props} />;
    case "datasets":
      return <DatasetExplorerScreen {...props} />;
    case "sources":
      return <SourceBrowserScreen />;
    case "graph":
      return <GraphScreen />;
    case "dataset-detail":
      return <DatasetDetailScreen />;
  }
}
