import { useState } from "react";
import { ThemeProvider, I18nProvider } from "./providers";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { renderRoute } from "./routes";
import { fonts } from "@/theme/tokens";
import type { Screen } from "@/types";

function Shell() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedDatasetId, setSelectedDatasetId] = useState("85039NED");
  const [researchQuestion, setResearchQuestion] = useState("");

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-background"
      style={{ fontFamily: fonts.body }}
    >
      <Sidebar screen={screen} setScreen={setScreen} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav screen={screen} setScreen={setScreen} />
        <main className="flex-1 overflow-hidden flex flex-col">
          {renderRoute(screen, setScreen, {
            selectedDatasetId,
            setSelectedDatasetId,
            researchQuestion,
            setResearchQuestion,
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
