import { BookOpen, Download, FileText, GitBranch, Link, MapPinned, NotebookPen, Printer, Table2 } from "lucide-react";
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
      <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-border bg-card px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Investigation Workspace</p>
          <h1 className="text-lg font-semibold text-foreground">{plan.question}</h1>
        </div>
        <div className="flex items-center gap-2">
          <MunicipalitySearch
            municipalities={municipalities}
            query={filters.query}
            onQueryChange={(query) => setFilters({ ...filters, query })}
            onSelect={(municipality) => setState({ ...state, selectedMunicipalityId: municipality.id })}
          />
          <button onClick={exportMarkdown} className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">Export</button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[330px_1fr_360px] gap-3 overflow-hidden p-3">
        <div className="min-h-0 space-y-3 overflow-y-auto">
          <Panel title="AI Research Summary" icon={<BookOpen size={14} />}>
            <p className="text-sm leading-6 text-muted-foreground">
              Guara found {plan.datasets.length} live CBS datasets for this investigation. The workspace is synchronized around
              {selectedMunicipality ? ` ${selectedMunicipality.name}` : " the selected municipality"} and
              {selectedDataset ? ` ${selectedDataset.id}` : " the selected dataset"}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
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

          <Panel title="Evidence Panel" icon={<FileText size={14} />}>
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
          </Panel>
        </div>

        <div className="grid min-h-0 grid-rows-[1fr_230px] gap-3">
          <section className="min-h-0 overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex h-11 items-center gap-2 border-b border-border px-4">
              <MapPinned size={14} className="text-muted-foreground" />
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground">Interactive Municipality Map</h2>
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

          <div className="grid min-h-0 grid-cols-2 gap-3">
            <Panel title="Knowledge Graph" icon={<GitBranch size={14} />}>
              <div className="relative h-40">
                {[...plan.concepts.map((concept, index) => ({ id: concept.id, label: concept.label, x: 20 + index * 55, y: 40 })), ...plan.datasets.slice(0, 3).map(({ dataset }, index) => ({ id: dataset.id, label: dataset.id, x: 50 + index * 70, y: 115 }))].map((node) => (
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
            <Panel title="Timeline" icon={<Table2 size={14} />}>
              <ol className="space-y-2 text-xs text-muted-foreground">
                {plan.datasets.slice(0, 4).map(({ dataset }) => (
                  <li key={dataset.id} className="flex justify-between gap-3">
                    <span className="truncate">{dataset.id}</span>
                    <span>{dataset.updated}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        </div>

        <div className="min-h-0 space-y-3 overflow-y-auto">
          <Panel title="Charts" icon={<Table2 size={14} />}>
            {selectedMetadata ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-muted p-3"><dt className="text-xs text-muted-foreground">Population</dt><dd className="font-semibold">{selectedMetadata.population.toLocaleString("en-US")}</dd></div>
                <div className="rounded-lg bg-muted p-3"><dt className="text-xs text-muted-foreground">65+ share</dt><dd className="font-semibold">{selectedMetadata.medianAge.toFixed(1)}%</dd></div>
                <div className="rounded-lg bg-muted p-3"><dt className="text-xs text-muted-foreground">WOZ value</dt><dd className="font-semibold">€{selectedMetadata.housePrice.toLocaleString("nl-NL")}</dd></div>
              </dl>
            ) : <p className="text-sm text-muted-foreground">Select a municipality to populate charts.</p>}
          </Panel>

          <Panel title="Research Notebook" icon={<NotebookPen size={14} />}>
            <textarea
              value={state.notes}
              onChange={(event) => setState({ ...state, notes: event.target.value })}
              className="h-72 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              style={{ fontFamily: fonts.mono }}
            />
          </Panel>

          <Panel title="Publish" icon={<Download size={14} />}>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
                <Printer size={13} /> PDF
              </button>
              <button onClick={exportMarkdown} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
                <Download size={13} /> Markdown
              </button>
              <button disabled className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground opacity-60">
                <FileText size={13} /> Word
              </button>
              <button disabled className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground opacity-60">
                <Table2 size={13} /> PowerPoint
              </button>
              <button disabled className="col-span-2 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground opacity-60">
                <Link size={13} /> Shareable link
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
