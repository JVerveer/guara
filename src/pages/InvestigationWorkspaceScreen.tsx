import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileText,
  GitBranch,
  HelpCircle,
  History,
  Link,
  MapPinned,
  Megaphone,
  MessageSquareReply,
  NotebookPen,
  Printer,
  Radar,
  SearchCheck,
  Sparkles,
  Table2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { MunicipalityMap } from "@/features/maps/components/MunicipalityMap";
import { MunicipalitySearch } from "@/features/maps/components/MunicipalitySearch";
import { populationLegend } from "@/features/maps/data/municipalityMapData";
import { getCbsMunicipalityMapSnapshot } from "@/features/maps/services/cbsMunicipalityService";
import { buildEvidenceFromPlan } from "@/features/investigation/services/investigationService";
import type { EvidenceItem, InvestigationState, ResearchPlan } from "@/features/investigation/types";
import type { ActiveFilters, DatasetValue, Municipality, MunicipalityMetadata } from "@/features/maps/types";
import { fonts } from "@/theme/tokens";
import type { Screen } from "@/types";

interface InvestigationWorkspaceScreenProps {
  plan: ResearchPlan | null;
  setScreen: (screen: Screen) => void;
}

const defaultFilters: ActiveFilters = {
  datasetId: "cbs-70072ned",
  year: 2024,
  indicator: "population",
  compareMode: false,
  query: "",
};

type LifecycleStageId =
  | "trigger"
  | "orientation"
  | "hypotheses"
  | "evidence"
  | "data"
  | "entities"
  | "timeline"
  | "gaps"
  | "verification"
  | "reply"
  | "story"
  | "monitoring";

const lifecycleStages: Array<{
  id: LifecycleStageId;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "trigger", label: "1. Trigger", icon: <Sparkles size={14} /> },
  { id: "orientation", label: "2. Orientation", icon: <BookOpen size={14} /> },
  { id: "hypotheses", label: "3. Forming Hypotheses", icon: <HelpCircle size={14} /> },
  { id: "evidence", label: "4. Evidence Collection", icon: <FileText size={14} /> },
  { id: "data", label: "5. Data Exploration", icon: <Table2 size={14} /> },
  { id: "entities", label: "6. Entity Discovery", icon: <GitBranch size={14} /> },
  { id: "timeline", label: "7. Timeline Reconstruction", icon: <History size={14} /> },
  { id: "gaps", label: "8. Contradiction and Gap Analysis", icon: <AlertTriangle size={14} /> },
  { id: "verification", label: "9. Verification", icon: <FileCheck2 size={14} /> },
  { id: "reply", label: "10. Right of Reply", icon: <MessageSquareReply size={14} /> },
  { id: "story", label: "11. Story Construction", icon: <Megaphone size={14} /> },
  { id: "monitoring", label: "12. Post Publication Monitoring", icon: <Radar size={14} /> },
];

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-h-0 rounded-lg border border-border bg-card">
      <div className="flex h-11 items-center gap-2 border-b border-border px-4">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function InvestigationWorkspaceScreen({ plan, setScreen }: InvestigationWorkspaceScreenProps) {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [metadataById, setMetadataById] = useState<Record<string, MunicipalityMetadata>>({});
  const [datasetValues, setDatasetValues] = useState<DatasetValue[]>([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [state, setState] = useState<InvestigationState | null>(null);
  const [activeStage, setActiveStage] = useState<LifecycleStageId>("trigger");
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!plan) return;
    setState({
      plan,
      selectedMunicipalityId: null,
      selectedDatasetId: plan.datasets[0]?.dataset.id ?? null,
      selectedConceptId: plan.concepts[0]?.id ?? null,
      comparedMunicipalityIds: [],
      notes: `Original question:\n${plan.question}\n\nRemaining questions:\n`,
    });
  }, [plan]);

  useEffect(() => {
    let cancelled = false;
    getCbsMunicipalityMapSnapshot()
      .then((snapshot) => {
        if (cancelled) return;
        setMunicipalities(snapshot.municipalities);
        setMetadataById(snapshot.metadataById);
        setDatasetValues(snapshot.datasetValues);
        setState((current) => current ? { ...current, selectedMunicipalityId: snapshot.municipalities[0]?.id ?? null } : current);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const evidence = useMemo<EvidenceItem[]>(() => (plan ? buildEvidenceFromPlan(plan) : []), [plan]);
  const selectedMunicipality = municipalities.find((municipality) => municipality.id === state?.selectedMunicipalityId) ?? null;
  const selectedMetadata = selectedMunicipality ? metadataById[selectedMunicipality.id] : undefined;
  const selectedDataset = plan?.datasets.find(({ dataset }) => dataset.id === state?.selectedDatasetId)?.dataset ?? null;
  const exportMarkdown = () => {
    const markdown = [
      `# ${plan.question}`,
      "",
      "## Hypotheses",
      ...plan.hypotheses.map((hypothesis) => `- ${hypothesis}`),
      "",
      "## Evidence",
      ...evidence.map((item) => `- **${item.dataset}**: ${item.statement} (${item.api})`),
      "",
      "## Notes",
      state.notes,
    ].join("\n");
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "guara-investigation.md";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const activeValues = datasetValues.filter(
    (value) => value.datasetId === filters.datasetId && value.indicator === filters.indicator && value.year === filters.year
  );
  const values = activeValues.map((value) => value.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const colorScale = (value: number | undefined, municipality: Municipality) => {
    if (municipality.disabled || value === undefined || max === min) return "#E9EEE9";
    const colors = ["#EAF2EA", "#CFE2D3", "#9FC8B0", "#5C9E87", "#1D6F63"];
    const step = Math.min(colors.length - 1, Math.floor(((value - min) / (max - min)) * colors.length));
    return colors[step] ?? "#E9EEE9";
  };

  const renderEvidenceList = () => (
    <div className="space-y-3">
      {evidence.map((item) => (
        <button
          key={item.id}
          onClick={() => setState({ ...state, selectedDatasetId: item.id })}
          className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
        >
          <p className="text-sm font-semibold text-foreground">{item.dataset}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.statement}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <dt className="text-muted-foreground">Source</dt><dd className="text-foreground">{item.source}</dd>
            <dt className="text-muted-foreground">Confidence</dt><dd className="text-foreground">{item.confidence}%</dd>
            <dt className="text-muted-foreground">License</dt><dd className="text-foreground">{item.license}</dd>
          </dl>
        </button>
      ))}
    </div>
  );

  const renderLifecycleContent = () => {
    switch (activeStage) {
      case "trigger":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-3 overflow-hidden p-3">
            <Panel title="Investigation Trigger" icon={<Sparkles size={14} />}>
              <p className="text-sm font-medium text-foreground">{plan.question}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Start by preserving the original question, the initiating signal, and the first assumptions before the research changes shape.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Detected concepts</p><p className="mt-1 text-lg font-semibold">{plan.concepts.length}</p></div>
                <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Relevant datasets</p><p className="mt-1 text-lg font-semibold">{plan.datasets.length}</p></div>
                <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Evidence leads</p><p className="mt-1 text-lg font-semibold">{evidence.length}</p></div>
              </div>
            </Panel>
            <Panel title="Initial Notes" icon={<NotebookPen size={14} />}>
              <textarea
                value={state.notes}
                onChange={(event) => setState({ ...state, notes: event.target.value })}
                className="h-[420px] w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                style={{ fontFamily: fonts.mono }}
              />
            </Panel>
          </div>
        );
      case "orientation":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr] gap-3 overflow-hidden p-3">
            <Panel title="Orientation Brief" icon={<BookOpen size={14} />}>
              <p className="text-sm leading-6 text-muted-foreground">
                Guara found {plan.datasets.length} live CBS datasets and {plan.concepts.length} concepts. Use this stage to understand scope, definitions, and likely blind spots.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {plan.concepts.map((concept) => (
                  <button
                    key={concept.id}
                    onClick={() => setState({ ...state, selectedConceptId: concept.id })}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${state.selectedConceptId === concept.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                  >
                    {concept.label}
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title="Relevant Datasets" icon={<Table2 size={14} />}>
              <div className="grid grid-cols-2 gap-3">
                {plan.datasets.map(({ dataset, reason }) => (
                  <button
                    key={dataset.id}
                    onClick={() => setState({ ...state, selectedDatasetId: dataset.id })}
                    className="rounded-lg border border-border p-3 text-left hover:bg-muted"
                  >
                    <p className="text-sm font-semibold text-foreground">{dataset.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{dataset.id} · {dataset.provider}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{reason}</p>
                  </button>
                ))}
              </div>
            </Panel>
          </div>
        );
      case "hypotheses":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-3 overflow-hidden p-3">
            <Panel title="Hypotheses" icon={<HelpCircle size={14} />}>
              <div className="space-y-3">
                {plan.hypotheses.map((hypothesis, index) => (
                  <div key={hypothesis} className="rounded-lg border border-border p-3">
                    <p className="text-xs font-semibold text-muted-foreground">Hypothesis {index + 1}</p>
                    <p className="mt-1 text-sm text-foreground">{hypothesis}</p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Next Tests" icon={<SearchCheck size={14} />}>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Select a dataset that can disprove each hypothesis.</li>
                <li>Identify one municipality or period where the hypothesis should fail.</li>
                <li>Record the transformation needed before trusting a comparison.</li>
              </ul>
            </Panel>
          </div>
        );
      case "evidence":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-3 overflow-hidden p-3">
            <Panel title="Evidence Collection" icon={<FileText size={14} />}>{renderEvidenceList()}</Panel>
            <Panel title="Provenance Checklist" icon={<CheckCircle2 size={14} />}>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Source, dataset, variables, API, and license captured.</li>
                <li>Confidence noted for each evidence lead.</li>
                <li>Transformation still needs inspection before conclusions.</li>
              </ul>
            </Panel>
          </div>
        );
      case "data":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_330px] gap-3 overflow-hidden p-3">
            <section className="min-h-0 overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex h-11 items-center gap-2 border-b border-border px-4">
                <MapPinned size={14} className="text-muted-foreground" />
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground">Data Exploration</h2>
                <select
                  value={filters.indicator}
                  onChange={(event) => setFilters({ ...filters, indicator: event.target.value })}
                  className="ml-auto h-8 rounded-md border border-border bg-background px-2 text-xs"
                >
                  <option value="population">Population</option>
                  <option value="housing">Average WOZ value</option>
                  <option value="density">Population density</option>
                </select>
              </div>
              <MunicipalityMap
                municipalities={municipalities}
                metadataById={metadataById}
                datasetValues={datasetValues}
                selectedMunicipalityId={state.selectedMunicipalityId}
                comparedMunicipalityIds={state.comparedMunicipalityIds}
                colorScale={colorScale}
                legend={populationLegend}
                activeFilters={filters}
                onSelectMunicipality={(municipality) => setState({ ...state, selectedMunicipalityId: municipality.id })}
              />
            </section>
            <Panel title="Selected Entity" icon={<Eye size={14} />}>
              {selectedMetadata ? (
                <dl className="grid grid-cols-1 gap-3 text-sm">
                  <div className="rounded-lg bg-muted p-3"><dt className="text-xs text-muted-foreground">Municipality</dt><dd className="font-semibold">{selectedMunicipality?.name}</dd></div>
                  <div className="rounded-lg bg-muted p-3"><dt className="text-xs text-muted-foreground">Population</dt><dd className="font-semibold">{selectedMetadata.population.toLocaleString("en-US")}</dd></div>
                  <div className="rounded-lg bg-muted p-3"><dt className="text-xs text-muted-foreground">WOZ value</dt><dd className="font-semibold">€{selectedMetadata.housePrice.toLocaleString("nl-NL")}</dd></div>
                </dl>
              ) : <p className="text-sm text-muted-foreground">Select a municipality to populate this stage.</p>}
            </Panel>
          </div>
        );
      case "entities":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-[330px_1fr] gap-3 overflow-hidden p-3">
            <Panel title="Entity Search" icon={<SearchCheck size={14} />}>
              <MunicipalitySearch
                municipalities={municipalities}
                query={filters.query}
                onQueryChange={(query) => setFilters({ ...filters, query })}
                onSelect={(municipality) => setState({ ...state, selectedMunicipalityId: municipality.id })}
              />
            </Panel>
            <Panel title="Entity Discovery Graph" icon={<GitBranch size={14} />}>
              <div className="relative h-[430px]">
                {[...plan.concepts.map((concept, index) => ({ id: concept.id, label: concept.label, x: 30 + index * 78, y: 65 })), ...plan.datasets.slice(0, 4).map(({ dataset }, index) => ({ id: dataset.id, label: dataset.id, x: 55 + index * 105, y: 230 }))].map((node) => (
                  <button
                    key={node.id}
                    onClick={() => setState({ ...state, selectedConceptId: node.id, selectedDatasetId: plan.datasets.find(({ dataset }) => dataset.id === node.id)?.dataset.id ?? state.selectedDatasetId })}
                    className="absolute rounded-md border border-border bg-background px-2 py-1 text-[11px] shadow-sm"
                    style={{ left: node.x, top: node.y }}
                  >
                    {node.label}
                  </button>
                ))}
              </div>
            </Panel>
          </div>
        );
      case "timeline":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-3 overflow-hidden p-3">
            <Panel title="Timeline Reconstruction" icon={<Clock3 size={14} />}>
              <ol className="space-y-3 text-sm">
                {plan.datasets.map(({ dataset }) => (
                  <li key={dataset.id} className="flex justify-between gap-4 rounded-lg border border-border p-3">
                    <span className="font-medium text-foreground">{dataset.title}</span>
                    <span className="text-muted-foreground">{dataset.updated}</span>
                  </li>
                ))}
              </ol>
            </Panel>
            <Panel title="Temporal Questions" icon={<History size={14} />}>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>What changed before the observed shift?</li>
                <li>Which datasets have comparable year coverage?</li>
                <li>Where is the timeline missing source data?</li>
              </ul>
            </Panel>
          </div>
        );
      case "gaps":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-hidden p-3">
            <Panel title="Contradictions" icon={<AlertTriangle size={14} />}>
              <p className="text-sm text-muted-foreground">No hard contradictions have been verified yet. Add claims here when sources disagree.</p>
            </Panel>
            <Panel title="Gap Analysis" icon={<HelpCircle size={14} />}>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Missing non-CBS source checks.</li>
                <li>Municipality boundary changes may affect comparisons.</li>
                <li>Transformation logic still needs inspection before publication.</li>
              </ul>
            </Panel>
          </div>
        );
      case "verification":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-3 overflow-hidden p-3">
            <Panel title="Verification Queue" icon={<FileCheck2 size={14} />}>{renderEvidenceList()}</Panel>
            <Panel title="Verification Rules" icon={<CheckCircle2 size={14} />}>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Each claim must link to an API source and variables.</li>
                <li>Each comparison needs aligned geography and period definitions.</li>
                <li>Each chart must keep transformation notes.</li>
              </ul>
            </Panel>
          </div>
        );
      case "reply":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-hidden p-3">
            <Panel title="Right of Reply" icon={<MessageSquareReply size={14} />}>
              <textarea className="h-[420px] w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Record contacted organizations, response deadlines, and replies." />
            </Panel>
            <Panel title="Parties To Contact" icon={<Eye size={14} />}>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>CBS or source owner for dataset interpretation.</li>
                <li>Relevant municipality or ministry.</li>
                <li>Domain expert for independent context.</li>
              </ul>
            </Panel>
          </div>
        );
      case "story":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px] gap-3 overflow-hidden p-3">
            <Panel title="Story Construction" icon={<Megaphone size={14} />}>
              <textarea
                value={state.notes}
                onChange={(event) => setState({ ...state, notes: event.target.value })}
                className="h-[420px] w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                style={{ fontFamily: fonts.mono }}
              />
            </Panel>
            <Panel title="Publish" icon={<Download size={14} />}>
              <div className="grid grid-cols-1 gap-2">
                <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground"><Printer size={13} /> PDF</button>
                <button onClick={exportMarkdown} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground"><Download size={13} /> Markdown</button>
                <button disabled className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground opacity-60"><FileText size={13} /> Word</button>
                <button disabled className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground opacity-60"><Table2 size={13} /> PowerPoint</button>
                <button disabled className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground opacity-60"><Link size={13} /> Shareable link</button>
              </div>
            </Panel>
          </div>
        );
      case "monitoring":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-hidden p-3">
            <Panel title="Post Publication Monitoring" icon={<Radar size={14} />}>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Track source updates for selected datasets.</li>
                <li>Monitor new evidence that changes confidence.</li>
                <li>Record corrections, replies, and follow-up questions.</li>
              </ul>
            </Panel>
            <Panel title="Open Questions" icon={<NotebookPen size={14} />}>
              <textarea className="h-[420px] w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="Remaining questions after publication." />
            </Panel>
          </div>
        );
    }
  };

  if (!plan || !state) {
    return (
      <ErrorState
        message="Create a research plan before opening the workspace."
        onRetry={() => setScreen("home")}
        retryLabel="Start investigation"
        className="flex-1"
      />
    );
  }

  if (error) return <ErrorState message={error.message} onRetry={() => window.location.reload()} retryLabel="Retry" className="flex-1" />;
  if (municipalities.length === 0) return <LoadingState message="Loading synchronized CBS and PDOK workspace..." className="flex-1" />;

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-background">
      <div className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2">
        {lifecycleStages.map((stage) => (
          <button
            key={stage.id}
            type="button"
            onClick={() => setActiveStage(stage.id)}
            className={`flex h-9 flex-shrink-0 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors ${
              activeStage === stage.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {stage.icon}
            <span>{stage.label}</span>
          </button>
        ))}
      </div>

      {renderLifecycleContent()}
    </div>
  );
}
