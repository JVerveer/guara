import { useCallback, useState } from "react";
import { ThemeProvider, I18nProvider } from "./providers";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { renderRoute } from "./routes";
import { fonts } from "@/theme/tokens";
import type { Screen } from "@/types";
import type { ResearchPlan } from "@/features/investigation/types";

function Shell() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedDatasetId, setSelectedDatasetId] = useState("85039NED");
  const [researchQuestion, setResearchQuestion] = useState("");
  const [researchPlan, setResearchPlan] = useState<ResearchPlan | null>(null);
  const [researchTitle, setResearchTitle] = useState("");

  const handleSetResearchPlan = useCallback((plan: ResearchPlan) => {
    setResearchPlan(plan);
    setResearchTitle(plan.question);
  }, []);

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-background"
      style={{ fontFamily: fonts.body }}
    >
      <Sidebar screen={screen} setScreen={setScreen} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav
          screen={screen}
          setScreen={setScreen}
          researchTitle={researchTitle || researchPlan?.question || researchQuestion}
          onRenameResearchTitle={setResearchTitle}
        />
        <main className="flex-1 overflow-hidden flex flex-col">
          {renderRoute(screen, setScreen, {
            selectedDatasetId,
            setSelectedDatasetId,
            researchQuestion,
            setResearchQuestion,
            researchPlan,
            setResearchPlan: handleSetResearchPlan,
          })}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </I18nProvider>
  );
}
