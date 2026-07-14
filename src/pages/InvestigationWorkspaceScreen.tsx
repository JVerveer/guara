import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  CheckCircle2,
  Clock3,
  Command,
  Database,
  Download,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  Filter,
  GitBranch,
  HelpCircle,
  History,
  Link,
  Network,
  NotebookPen,
  Paperclip,
  Pin,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Table2,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { buildEvidenceFromPlan } from "@/features/investigation/services/investigationService";
import type { EvidenceItem, InvestigationState, ResearchPlan } from "@/features/investigation/types";
import { MunicipalityMap } from "@/features/maps/components/MunicipalityMap";
import { populationLegend } from "@/features/maps/data/municipalityMapData";
import { getCbsMunicipalityMapSnapshot } from "@/features/maps/services/cbsMunicipalityService";
import type { ActiveFilters, DatasetValue, Municipality, MunicipalityMetadata } from "@/features/maps/types";
import { fonts } from "@/theme/tokens";
import type { Screen } from "@/types";

interface InvestigationWorkspaceScreenProps {
  plan: ResearchPlan | null;
  setScreen: (screen: Screen) => void;
}

const defaultFilters: ActiveFilters = {
  datasetId: "cbs-silver",
  year: 2024,
  indicator: "population",
  compareMode: false,
  query: "",
};

type WorkspaceId =
  | "dashboard"
  | "collector"
  | "finder"
  | "hypotheses"
  | "graph"
  | "gaps"
  | "verification"
  | "story"
  | "monitoring";

type NoteScope = "Investigation" | "Current tab" | "Selected object";

interface WorkspaceNote {
  id: string;
  scope: NoteScope;
  title: string;
  body: string;
  tags: string[];
  visibility: "Private" | "Shared";
  status: "Active" | "Resolved" | "Archived";
  author: string;
  timestamp: string;
}

const workspaces: Array<{ id: WorkspaceId; label: string; icon: React.ReactNode }> = [
  { id: "dashboard", label: "Dashboard", icon: <Activity size={14} /> },
  { id: "collector", label: "Evidence Collector", icon: <FilePlus2 size={14} /> },
  { id: "finder", label: "Evidence Finder", icon: <Search size={14} /> },
  { id: "hypotheses", label: "Hypothesis Builder", icon: <HelpCircle size={14} /> },
  { id: "graph", label: "Graph & Timeline", icon: <Network size={14} /> },
  { id: "gaps", label: "Contradictions & Gaps", icon: <AlertTriangle size={14} /> },
  { id: "verification", label: "Verification", icon: <ShieldCheck size={14} /> },
  { id: "story", label: "Story Construction", icon: <BookOpen size={14} /> },
  { id: "monitoring", label: "Monitoring", icon: <Bell size={14} /> },
];

function createInitialInvestigationState(plan: ResearchPlan): InvestigationState {
  return {
    plan,
    selectedMunicipalityId: null,
    selectedDatasetId: plan.datasets[0]?.dataset.id ?? null,
    selectedConceptId: plan.concepts[0]?.id ?? null,
    comparedMunicipalityIds: [],
    notes: `Original question:\n${plan.question}\n\nRemaining questions:\n`,
  };
}

function createInitialNotes(plan: ResearchPlan): WorkspaceNote[] {
  return [
    {
      id: "investigation-note",
      scope: "Investigation",
      title: "Original investigation frame",
      body: `Question: ${plan.question}\n\nKeep track of definitions, assumptions, and open verification issues here.`,
      tags: ["orientation", "scope"],
      visibility: "Private",
      status: "Active",
      author: "ML",
      timestamp: "Just now",
    },
    {
      id: "tab-note",
      scope: "Current tab",
      title: "Current workspace notes",
      body: "Capture observations that only apply to the selected workspace.",
      tags: ["workspace"],
      visibility: "Private",
      status: "Active",
      author: "ML",
      timestamp: "Just now",
    },
  ];
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-h-0 rounded-lg border border-border bg-card">
      <div className="flex h-11 items-center gap-2 border-b border-border px-4">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="truncate text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground">{title}</h2>
      </div>
      <div className="min-h-0 p-4">{children}</div>
    </section>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function NotesDrawer({
  open,
  notes,
  selectedObjectLabel,
  activeWorkspaceLabel,
  onClose,
  onChange,
}: {
  open: boolean;
  notes: WorkspaceNote[];
  selectedObjectLabel: string;
  activeWorkspaceLabel: string;
  onClose: () => void;
  onChange: (notes: WorkspaceNote[]) => void;
}) {
  const scopedNotes = [
    ...notes,
    {
      id: "selected-object-note",
      scope: "Selected object" as const,
      title: selectedObjectLabel,
      body: "Notes linked to the currently selected object appear here.",
      tags: ["linked-object"],
      visibility: "Private" as const,
      status: "Active" as const,
      author: "ML",
      timestamp: "Live",
    },
  ];

  const updateNote = (id: string, patch: Partial<WorkspaceNote>) => {
    if (id === "selected-object-note") return;
    onChange(notes.map((note) => (note.id === id ? { ...note, ...patch } : note)));
  };

  return (
    <aside
      className={`absolute right-0 top-0 z-30 h-full w-[400px] border-l border-border bg-card shadow-xl transition-transform duration-200 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Notes</p>
          <p className="text-xs text-muted-foreground">{activeWorkspaceLabel}</p>
        </div>
        <button onClick={onClose} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
          Close
        </button>
      </div>
      <div className="h-[calc(100%-3.5rem)] space-y-3 overflow-y-auto p-4">
        {scopedNotes.map((note) => (
          <article key={note.id} className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{note.scope}</span>
              <span className="text-[11px] text-muted-foreground">{note.timestamp}</span>
            </div>
            <input
              value={note.title}
              readOnly={note.id === "selected-object-note"}
              onChange={(event) => updateNote(note.id, { title: event.target.value })}
              className="mt-3 w-full border-0 bg-transparent text-sm font-semibold text-foreground outline-none"
            />
            <textarea
              value={note.body}
              readOnly={note.id === "selected-object-note"}
              onChange={(event) => updateNote(note.id, { body: event.target.value })}
              className="mt-2 h-28 w-full resize-none rounded-md border border-border bg-card p-2 text-sm leading-5 text-foreground outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {note.tags.map((tag) => (
                <span key={tag} className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  #{tag}
                </span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select
                value={note.visibility}
                disabled={note.id === "selected-object-note"}
                onChange={(event) => updateNote(note.id, { visibility: event.target.value as WorkspaceNote["visibility"] })}
                className="h-8 rounded-md border border-border bg-card px-2 text-xs"
              >
                <option>Private</option>
                <option>Shared</option>
              </select>
              <select
                value={note.status}
                disabled={note.id === "selected-object-note"}
                onChange={(event) => updateNote(note.id, { status: event.target.value as WorkspaceNote["status"] })}
                className="h-8 rounded-md border border-border bg-card px-2 text-xs"
              >
                <option>Active</option>
                <option>Resolved</option>
                <option>Archived</option>
              </select>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              {["Task", "Hypothesis", "Evidence Annotation", "Timeline Event", "Claim", "Story Idea"].map((action) => (
                <button key={action} className="rounded-md border border-border px-2 py-1.5 text-muted-foreground hover:bg-muted">
                  Convert to {action}
                </button>
              ))}
              <button className="rounded-md border border-border px-2 py-1.5 text-muted-foreground hover:bg-muted">Pin to Dashboard</button>
              <button className="rounded-md border border-border px-2 py-1.5 text-muted-foreground hover:bg-muted">Link to Entity</button>
              <button className="rounded-md border border-border px-2 py-1.5 text-muted-foreground hover:bg-muted">Link to Evidence</button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Paperclip size={12} />
              <span>Attachments, mentions, and edit history are reserved for the persistent notes service.</span>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}

function CommandPalette({
  open,
  query,
  results,
  onQueryChange,
  onClose,
}: {
  open: boolean;
  query: string;
  results: Array<{ label: string; type: string; detail: string }>;
  onQueryChange: (query: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-foreground/10 px-6 pt-20 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Command size={16} className="text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
            }}
            placeholder="Search evidence, notes, datasets, hypotheses, claims, timeline, entities, tasks..."
            className="h-full flex-1 border-0 bg-transparent text-sm outline-none"
          />
          <button onClick={onClose} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
            Esc
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {results.map((result) => (
            <button key={`${result.type}-${result.label}`} className="flex w-full items-start gap-3 rounded-lg p-3 text-left hover:bg-muted">
              <span className="mt-0.5 rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{result.type}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{result.label}</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">{result.detail}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function InvestigationWorkspaceScreen({ plan, setScreen }: InvestigationWorkspaceScreenProps) {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [metadataById, setMetadataById] = useState<Record<string, MunicipalityMetadata>>({});
  const [datasetValues, setDatasetValues] = useState<DatasetValue[]>([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [state, setState] = useState<InvestigationState | null>(() => (plan ? createInitialInvestigationState(plan) : null));
  const [notes, setNotes] = useState<WorkspaceNote[]>(() => (plan ? createInitialNotes(plan) : []));
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>("dashboard");
  const [notesOpen, setNotesOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [mapError, setMapError] = useState<Error | null>(null);
  const [mapLoading, setMapLoading] = useState(true);

  useEffect(() => {
    if (!plan) return;
    setState(createInitialInvestigationState(plan));
    setNotes(createInitialNotes(plan));
  }, [plan]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMapLoading(true);
    setMapError(null);
    getCbsMunicipalityMapSnapshot()
      .then((snapshot) => {
        if (cancelled) return;
        setMunicipalities(snapshot.municipalities);
        setMetadataById(snapshot.metadataById);
        setDatasetValues(snapshot.datasetValues);
        setFilters((current) => ({
          ...current,
          datasetId: snapshot.datasetValues[0]?.datasetId ?? current.datasetId,
          year: snapshot.datasetValues[0]?.year ?? current.year,
        }));
        setState((current) => current ? { ...current, selectedMunicipalityId: snapshot.municipalities[0]?.id ?? null } : current);
      })
      .catch((err: unknown) => {
        if (!cancelled) setMapError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setMapLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const evidence = useMemo<EvidenceItem[]>(() => (plan ? buildEvidenceFromPlan(plan) : []), [plan]);

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

  const activeWorkspaceMeta = workspaces.find((workspace) => workspace.id === activeWorkspace) ?? workspaces[0];
  const selectedMunicipality = municipalities.find((municipality) => municipality.id === state.selectedMunicipalityId) ?? null;
  const selectedMetadata = selectedMunicipality ? metadataById[selectedMunicipality.id] : undefined;
  const selectedDataset = plan.datasets.find(({ dataset }) => dataset.id === state.selectedDatasetId)?.dataset;
  const selectedObjectLabel = selectedMunicipality?.name ?? selectedDataset?.title ?? "No selected object";

  const activeValues = datasetValues.filter(
    (value) => value.datasetId === filters.datasetId && value.indicator === filters.indicator && value.year === filters.year
  );
  const values = activeValues.map((value) => value.value);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;
  const colorScale = (value: number | undefined, municipality: Municipality) => {
    if (municipality.disabled || value === undefined || max === min) return "#E9EEE9";
    const colors = ["#EAF2EA", "#CFE2D3", "#9FC8B0", "#5C9E87", "#1D6F63"];
    const step = Math.min(colors.length - 1, Math.floor(((value - min) / (max - min)) * colors.length));
    return colors[step] ?? "#E9EEE9";
  };

  const commandResults = [
    ...evidence.map((item) => ({ label: item.dataset, type: "Evidence", detail: item.statement })),
    ...plan.datasets.map(({ dataset }) => ({ label: dataset.title, type: "Dataset", detail: `${dataset.id} · ${dataset.provider}` })),
    ...plan.hypotheses.map((hypothesis) => ({ label: hypothesis, type: "Hypothesis", detail: "Generated from the research plan" })),
    ...plan.concepts.map((concept) => ({ label: concept.label, type: "Entity", detail: "Detected concept" })),
    ...notes.map((note) => ({ label: note.title, type: "Note", detail: note.body })),
  ].filter((result) => {
    const q = commandQuery.trim().toLowerCase();
    return !q || `${result.label} ${result.type} ${result.detail}`.toLowerCase().includes(q);
  });

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
      ...notes.map((note) => `### ${note.title}\n${note.body}`),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "guara-investigation.md";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const renderMapContent = () => {
    if (mapLoading) {
      return <LoadingState message="Loading municipality evidence from Supabase silver tables..." className="h-full" />;
    }

    if (mapError) {
      return (
        <div className="flex h-full items-center justify-center bg-[#F7F7F4] p-8">
          <div className="max-w-md rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
            <p className="font-semibold text-foreground">Map data unavailable</p>
            <p className="mt-2 leading-6">{mapError.message}</p>
          </div>
        </div>
      );
    }

    if (municipalities.length === 0) {
      return (
        <div className="flex h-full items-center justify-center bg-[#F7F7F4] p-8">
          <div className="max-w-md rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
            <p className="font-semibold text-foreground">No municipality map data yet</p>
            <p className="mt-2 leading-6">
              No municipality preview rows are available from Supabase silver yet. Keep investigating and treat the missing layer as a data gap.
            </p>
          </div>
        </div>
      );
    }

    return (
      <MunicipalityMap
        municipalities={municipalities}
        metadataById={metadataById}
        datasetValues={datasetValues}
        selectedMunicipalityId={state.selectedMunicipalityId}
        comparedMunicipalityIds={state.comparedMunicipalityIds}
        colorScale={colorScale}
        legend={populationLegend}
        activeFilters={filters}
        onSelectMunicipality={(municipality) => {
          setState((current) => current ? { ...current, selectedMunicipalityId: municipality.id } : current);
        }}
      />
    );
  };

  const renderEvidenceTable = () => (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Evidence</th>
            <th className="px-3 py-2">Reliability</th>
            <th className="px-3 py-2">Annotation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {evidence.map((item) => (
            <tr key={item.id} className="hover:bg-muted/60">
              <td className="px-3 py-3">
                <button
                  onClick={() => setState({ ...state, selectedDatasetId: item.id })}
                  className="text-left font-medium text-foreground"
                >
                  {item.dataset}
                </button>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.statement}</p>
              </td>
              <td className="px-3 py-3 text-xs text-muted-foreground">{item.confidence}% confidence</td>
              <td className="px-3 py-3 text-xs text-muted-foreground">Needs transformation review</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const sourceCards = [
    "CBS Silver datasets",
    "Connected sources",
    "Government portals",
    "RSS feeds",
    "Web pages",
    "Court documents",
    "Parliament documents",
    "Company registries",
  ];

  const renderWorkspace = () => {
    switch (activeWorkspace) {
      case "dashboard":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-3 overflow-auto p-3">
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <MetricCard label="Evidence collected" value={evidence.length} detail="Dataset-backed evidence leads" />
                <MetricCard label="Hypotheses" value={plan.hypotheses.length} detail="Generated for investigation planning" />
                <MetricCard label="Verified claims" value="0" detail="Awaiting verification workflow" />
                <MetricCard label="Contradictions" value="0" detail="No confirmed conflicts yet" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Panel title="Investigation Health" icon={<Activity size={14} />}>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>Evidence and hypotheses are initialized. Verification, right-of-reply, and legal review are still open.</p>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-[38%] rounded-full bg-primary" />
                    </div>
                  </div>
                </Panel>
                <Panel title="Recent AI Suggestions" icon={<Sparkles size={14} />}>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>Check whether geographic levels are comparable before making municipality claims.</li>
                    <li>Look for non-CBS evidence to reduce source concentration risk.</li>
                    <li>Turn the strongest hypothesis into a claim only after verification.</li>
                  </ul>
                </Panel>
                <Panel title="Pinned Notes" icon={<Pin size={14} />}>
                  <p className="text-sm text-muted-foreground">{notes[0]?.title}</p>
                </Panel>
                <Panel title="Outstanding Tasks" icon={<CheckCircle2 size={14} />}>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>Inspect variables and transformations for selected datasets.</li>
                    <li>Build first claim cards from verified evidence.</li>
                    <li>Identify missing years, entities, and contradictory sources.</li>
                  </ul>
                </Panel>
              </div>
            </div>
            <Panel title="Timeline Preview" icon={<History size={14} />}>
              <ol className="space-y-3 text-sm">
                {plan.datasets.slice(0, 5).map(({ dataset }) => (
                  <li key={dataset.id} className="rounded-lg border border-border p-3">
                    <p className="font-medium text-foreground">{dataset.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Last updated {dataset.updated}</p>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        );
      case "collector":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-3 overflow-hidden p-3">
            <Panel title="Collect Information" icon={<FilePlus2 size={14} />}>
              <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center">
                <UploadCloud className="mx-auto text-muted-foreground" size={28} />
                <p className="mt-3 text-sm font-semibold text-foreground">Drop files, source exports, or documents here</p>
                <p className="mt-1 text-xs text-muted-foreground">Uploads will become evidence objects with metadata, provenance, and notes.</p>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-3">
                {sourceCards.map((source) => (
                  <div key={source} className="rounded-lg border border-border bg-background p-3">
                    <p className="text-sm font-medium text-foreground">{source}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Ready to connect</p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Import Progress" icon={<Database size={14} />}>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>CBS Silver is the current primary evidence source.</p>
                <p>Metadata preview, connection status, and import progress will appear here per source.</p>
              </div>
            </Panel>
          </div>
        );
      case "finder":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr_360px] gap-3 overflow-hidden p-3">
            <Panel title="Filters" icon={<Filter size={14} />}>
              <div className="space-y-3 text-sm">
                {["Table", "Map", "Charts", "Cards", "Timeline"].map((view) => (
                  <button key={view} className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-muted-foreground hover:bg-muted">
                    <span>{view}</span>
                    <Eye size={13} />
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title="Evidence Table" icon={<Table2 size={14} />}>{renderEvidenceTable()}</Panel>
            <Panel title="Selected Evidence Details" icon={<FileText size={14} />}>
              <dl className="space-y-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Source</dt><dd className="font-medium text-foreground">{selectedDataset?.provider ?? "Select evidence"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Reliability score</dt><dd className="font-medium text-foreground">Pending review</dd></div>
                <div><dt className="text-xs text-muted-foreground">Annotations</dt><dd className="text-muted-foreground">Create evidence annotations from notes or claims.</dd></div>
              </dl>
            </Panel>
          </div>
        );
      case "hypotheses":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-3 overflow-auto p-3">
            <div className="grid grid-cols-2 gap-3">
              {plan.hypotheses.map((hypothesis, index) => (
                <section key={hypothesis} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Hypothesis {index + 1}</p>
                    <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Needs review</span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-foreground">{hypothesis}</p>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-background p-2"><dt className="text-muted-foreground">Supporting evidence</dt><dd className="font-medium">{Math.min(evidence.length, 2)}</dd></div>
                    <div className="rounded bg-background p-2"><dt className="text-muted-foreground">Contradicting evidence</dt><dd className="font-medium">0</dd></div>
                    <div className="rounded bg-background p-2"><dt className="text-muted-foreground">Confidence</dt><dd className="font-medium">Draft</dd></div>
                    <div className="rounded bg-background p-2"><dt className="text-muted-foreground">Open questions</dt><dd className="font-medium">3</dd></div>
                  </dl>
                </section>
              ))}
            </div>
            <Panel title="AI Suggestions" icon={<Sparkles size={14} />}>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Find one disconfirming dataset per hypothesis.</li>
                <li>Link each hypothesis to claims before story construction.</li>
                <li>Add entities and periods to make hypotheses testable.</li>
              </ul>
            </Panel>
          </div>
        );
      case "graph":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_420px] gap-3 overflow-hidden p-3">
            <Panel title="Knowledge Graph" icon={<GitBranch size={14} />}>
              <div className="relative h-[520px] rounded-lg bg-background">
                {[...plan.concepts.map((concept, index) => ({ id: concept.id, label: concept.label, x: 40 + index * 110, y: 80 })), ...plan.datasets.slice(0, 5).map(({ dataset }, index) => ({ id: dataset.id, label: dataset.id, x: 80 + index * 120, y: 280 }))].map((node) => (
                  <button
                    key={node.id}
                    onClick={() => setState({ ...state, selectedConceptId: node.id, selectedDatasetId: plan.datasets.find(({ dataset }) => dataset.id === node.id)?.dataset.id ?? state.selectedDatasetId })}
                    className="absolute rounded-md border border-border bg-card px-3 py-2 text-xs shadow-sm hover:bg-muted"
                    style={{ left: node.x, top: node.y }}
                  >
                    {node.label}
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title="Chronological Timeline" icon={<Clock3 size={14} />}>
              <ol className="space-y-3 text-sm">
                {plan.datasets.map(({ dataset }) => (
                  <li key={dataset.id} className="rounded-lg border border-border p-3">
                    <p className="font-medium text-foreground">{dataset.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{dataset.updated} · evidence, notes, claims, entities</p>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        );
      case "gaps":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-3 gap-3 overflow-auto p-3">
            {["Contradictions", "Missing evidence", "Weak evidence", "Unverified claims", "Missing years", "Missing entities", "Circular references", "AI suggestions"].map((title, index) => (
              <Panel key={title} title={title} icon={index === 0 ? <AlertTriangle size={14} /> : <HelpCircle size={14} />}>
                <p className="text-sm text-muted-foreground">No confirmed item yet. Add evidence or claims to activate this analysis lane.</p>
              </Panel>
            ))}
          </div>
        );
      case "verification":
        return (
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <Panel title="Professional Verification Board" icon={<FileCheck2 size={14} />}>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    <tr>
                      {["Claim", "Evidence count", "Reliability", "Reviewer", "Status", "Right of reply", "Legal review", "Publication readiness"].map((header) => (
                        <th key={header} className="px-3 py-2">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {plan.hypotheses.map((claim, index) => (
                      <tr key={claim}>
                        <td className="max-w-md px-3 py-3 font-medium text-foreground">{claim}</td>
                        <td className="px-3 py-3 text-muted-foreground">{index + 1}</td>
                        <td className="px-3 py-3 text-muted-foreground">Draft</td>
                        <td className="px-3 py-3 text-muted-foreground">Unassigned</td>
                        <td className="px-3 py-3"><span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">Needs review</span></td>
                        <td className="px-3 py-3 text-muted-foreground">Open</td>
                        <td className="px-3 py-3 text-muted-foreground">Open</td>
                        <td className="px-3 py-3 text-muted-foreground">Not ready</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        );
      case "story":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr_360px] gap-3 overflow-hidden p-3">
            <Panel title="Story Outline" icon={<BookOpen size={14} />}>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li>1. Lead</li>
                <li>2. Context</li>
                <li>3. Evidence</li>
                <li>4. Response</li>
                <li>5. What changes next</li>
              </ol>
            </Panel>
            <Panel title="Rich Editor" icon={<FileText size={14} />}>
              <textarea
                value={state.notes}
                onChange={(event) => setState({ ...state, notes: event.target.value })}
                className="h-[520px] w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                style={{ fontFamily: fonts.mono }}
              />
            </Panel>
            <Panel title="References" icon={<Link size={14} />}>
              <div className="space-y-2">
                {evidence.slice(0, 5).map((item) => (
                  <button key={item.id} className="w-full rounded-lg border border-border p-3 text-left text-sm hover:bg-muted">
                    <p className="font-medium text-foreground">{item.dataset}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Drag into editor after rich-text support is connected.</p>
                  </button>
                ))}
                <button onClick={exportMarkdown} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                  <Download size={14} /> Export Markdown
                </button>
              </div>
            </Panel>
          </div>
        );
      case "monitoring":
        return (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-3 overflow-auto p-3">
            <Panel title="Incoming Intelligence" icon={<Bell size={14} />}>
              <div className="grid grid-cols-2 gap-3">
                {["New dataset available", "Court ruling", "Tender published", "Company ownership changed", "Government report", "News article", "Social media mention", "Whistleblower submission"].map((alert) => (
                  <article key={alert} className="rounded-lg border border-border bg-background p-3">
                    <p className="text-sm font-medium text-foreground">{alert}</p>
                    <p className="mt-1 text-xs text-muted-foreground">AI explanation will describe why this matters before approval.</p>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                      {["Accept", "Note", "Hypothesis", "Claim", "Timeline", "Ignore", "Snooze", "Archive"].map((action) => (
                        <button key={action} className="rounded border border-border px-2 py-1 text-muted-foreground hover:bg-muted">
                          {action}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
            <Panel title="Monitoring Watches" icon={<Eye size={14} />}>
              <div className="space-y-3 text-sm">
                {["Companies", "People", "Municipalities", "Datasets", "Topics", "Organizations", "Keywords", "Legislation"].map((watch) => (
                  <div key={watch} className="rounded-lg border border-border p-3">
                    <p className="font-medium text-foreground">{watch}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Last update pending · 0 alerts · risk not scored</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        );
    }
  };

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-background">
      <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{plan.question}</p>
          <p className="text-xs text-muted-foreground">Investigation workspace · {activeWorkspaceMeta.label}</p>
        </div>
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex h-8 w-[260px] items-center gap-2 rounded-md border border-border bg-background px-2.5 text-left text-xs text-muted-foreground hover:bg-muted"
        >
          <Search size={14} />
          <span className="flex-1">Global search</span>
          <span className="rounded bg-muted px-1.5 py-0.5">⌘K</span>
        </button>
        <ToolbarButton icon={<Sparkles size={13} />} label="AI Copilot" active={copilotOpen} onClick={() => setCopilotOpen((open) => !open)} />
        <ToolbarButton icon={<Filter size={13} />} label="Filter" />
        <ToolbarButton icon={<Eye size={13} />} label="Save View" />
        <ToolbarButton icon={<Share2 size={13} />} label="Share" />
        <ToolbarButton icon={<Activity size={13} />} label="Activity" />
        <ToolbarButton icon={<Download size={13} />} label="Export" onClick={exportMarkdown} />
        <ToolbarButton icon={<NotebookPen size={13} />} label="Notes" active={notesOpen} onClick={() => setNotesOpen((open) => !open)} />
      </header>

      <nav className="flex flex-shrink-0 flex-wrap gap-1 border-b border-border bg-card px-3 py-2">
        {workspaces.map((workspace) => (
          <button
            key={workspace.id}
            type="button"
            onClick={() => setActiveWorkspace(workspace.id)}
            className={`flex h-8 flex-shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition-colors ${
              activeWorkspace === workspace.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {workspace.icon}
            <span>{workspace.label}</span>
          </button>
        ))}
      </nav>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <main className={`flex min-w-0 flex-1 flex-col transition-[margin] duration-200 ${notesOpen ? "mr-[400px]" : ""}`}>
          {renderWorkspace()}
        </main>

        {copilotOpen && (
          <aside className="w-[340px] flex-shrink-0 border-l border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              <p className="text-sm font-semibold text-foreground">AI Copilot</p>
            </div>
            <div className="mt-4 space-y-2">
              {[
                "Summarize evidence",
                "Suggest hypotheses",
                "Find contradictions",
                "Suggest entities",
                "Suggest relationships",
                "Explain trends",
                "Explain AI reasoning",
                "Suggest missing verification",
                "Suggest story improvements",
              ].map((action) => (
                <button key={action} className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  {action}
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>

      <NotesDrawer
        open={notesOpen}
        notes={notes}
        selectedObjectLabel={selectedObjectLabel}
        activeWorkspaceLabel={activeWorkspaceMeta.label}
        onClose={() => setNotesOpen(false)}
        onChange={setNotes}
      />
      <CommandPalette
        open={commandOpen}
        query={commandQuery}
        results={commandResults}
        onQueryChange={setCommandQuery}
        onClose={() => setCommandOpen(false)}
      />
    </div>
  );
}
