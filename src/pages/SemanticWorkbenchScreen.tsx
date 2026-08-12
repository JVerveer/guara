import { AlertTriangle, CheckCircle2, FlaskConical, Play, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  semanticWorkbenchService,
  type SemanticCatalogueData,
  type SemanticCatalogueItem,
  type SemanticDimensionValue,
  type SemanticMetricDetail,
  type SemanticSandboxResult,
} from "@/features/semantic/services/semanticWorkbenchService";
import { cn } from "@/lib/utils";
import { fonts } from "@/theme/tokens";

const statusTone: Record<string, string> = {
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  under_review: "border-blue-200 bg-blue-50 text-blue-700",
  needs_fix: "border-rose-200 bg-rose-50 text-rose-700",
  reviewed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  curated: "border-emerald-200 bg-emerald-50 text-emerald-700",
  profiled: "border-amber-200 bg-amber-50 text-amber-700",
  generated: "border-slate-200 bg-slate-50 text-slate-700",
  gold_profiled: "border-slate-200 bg-slate-50 text-slate-700",
};

function formatNumber(value: unknown) {
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || Number.isNaN(number)) return "0";
  return new Intl.NumberFormat("en-US").format(number);
}

function formatValue(value: unknown) {
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || Number.isNaN(number)) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(number);
}

function jsonText(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function itemKey(item: Pick<SemanticCatalogueItem, "domain_id" | "dataset_code" | "measure_key">) {
  return `${item.domain_id}:${item.dataset_code}:${item.measure_key}`;
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-medium", statusTone[value] ?? statusTone.generated)}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

function valuesByDimension(values: SemanticDimensionValue[]) {
  return values.reduce<Record<string, SemanticDimensionValue[]>>((groups, value) => {
    groups[value.dimension_code] = [...(groups[value.dimension_code] ?? []), value];
    return groups;
  }, {});
}

export function SemanticWorkbenchScreen() {
  const [catalogue, setCatalogue] = useState<SemanticCatalogueData | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [detail, setDetail] = useState<SemanticMetricDetail | null>(null);
  const [sandbox, setSandbox] = useState<SemanticSandboxResult | null>(null);
  const [domain, setDomain] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("latest");
  const [geographyType, setGeographyType] = useState("municipality");
  const [aggregation, setAggregation] = useState("sum");
  const [groupDimension, setGroupDimension] = useState("none");
  const [categoryFilters, setCategoryFilters] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSandboxLoading, setIsSandboxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => catalogue?.items.find((item) => itemKey(item) === selectedKey) ?? catalogue?.items[0] ?? null,
    [catalogue?.items, selectedKey]
  );

  const dimensionGroups = useMemo(() => valuesByDimension(detail?.dimensionValues ?? []), [detail?.dimensionValues]);
  const dimensions = useMemo(() => Object.keys(dimensionGroups).sort(), [dimensionGroups]);
  const selectedYearOptions = selectedItem?.available_years?.length ? selectedItem.available_years.slice().sort((a, b) => b - a) : [];
  const selectedGeographyOptions = selectedItem?.geography_types?.length ? selectedItem.geography_types.filter((value) => value !== "unknown") : ["municipality", "province", "country"];

  const loadCatalogue = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await semanticWorkbenchService.fetchCatalogue({ domain, status, query: search, limit: 5000 });
      setCatalogue(result);
      setSelectedKey((current) => current && result.items.some((item) => itemKey(item) === current) ? current : itemKey(result.items[0] ?? { domain_id: "", dataset_code: "", measure_key: 0 }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadCatalogue();
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [domain, status, search]);

  useEffect(() => {
    if (!selectedItem) {
      setDetail(null);
      return;
    }
    setDetail(null);
    setSandbox(null);
    setCategoryFilters({});
    setGroupDimension("none");
    setYear(selectedItem.max_year ? String(selectedItem.max_year) : "latest");
    setGeographyType(selectedItem.geography_types?.includes("municipality") ? "municipality" : selectedItem.geography_types?.[0] ?? "all");
    setAggregation(selectedItem.default_aggregation && selectedItem.default_aggregation !== "none" ? selectedItem.default_aggregation : selectedItem.is_non_additive ? "average" : "sum");

    const loadDetail = async () => {
      setIsDetailLoading(true);
      try {
        setDetail(await semanticWorkbenchService.fetchMetricDetail(selectedItem));
      } catch (detailError) {
        setError(detailError instanceof Error ? detailError.message : String(detailError));
      } finally {
        setIsDetailLoading(false);
      }
    };
    void loadDetail();
  }, [selectedItem?.domain_id, selectedItem?.dataset_code, selectedItem?.measure_key]);

  const runSandbox = async () => {
    if (!selectedItem) return;
    setIsSandboxLoading(true);
    setError(null);
    try {
      setSandbox(await semanticWorkbenchService.runAggregationSandbox({
        item: selectedItem,
        year: year === "latest" ? selectedItem.max_year : Number(year),
        geographyType,
        aggregation,
        categoryFilters,
        groupDimension: groupDimension === "none" ? null : groupDimension,
      }));
    } catch (sandboxError) {
      setError(sandboxError instanceof Error ? sandboxError.message : String(sandboxError));
    } finally {
      setIsSandboxLoading(false);
    }
  };

  const counts = catalogue?.summary ?? {};
  if (isLoading && !catalogue) return <LoadingState message="Loading semantic Gold catalogue" className="flex-1" />;
  if (error && !catalogue) return <ErrorState message={error} onRetry={loadCatalogue} retryLabel="Retry" className="flex-1" />;

  return (
    <div className="flex-1 overflow-hidden bg-[#f7f6f2]">
      <div className="flex h-full flex-col px-7 py-6">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck size={13} />
              Semantic governance
            </div>
            <h1 className="text-3xl text-foreground" style={{ fontFamily: fonts.display, fontWeight: 400 }}>
              Semantic Workbench
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Inspect every profiled semantic measure from the Gold marts, review its approval state, and test how dimensional values behave in aggregations.
            </p>
          </div>
          <Button variant="outline" onClick={loadCatalogue} disabled={isLoading}>
            <RefreshCw size={14} className={cn(isLoading && "animate-spin")} />
            Refresh
          </Button>
        </header>

        <section className="mb-4 grid grid-cols-5 gap-3">
          {[
            { label: "Gold measures", value: catalogue?.items.length ?? 0, icon: <ShieldCheck size={15} /> },
            { label: "Approved", value: counts.approved ?? 0, icon: <CheckCircle2 size={15} /> },
            { label: "Under review", value: counts.under_review ?? 0, icon: <Sparkles size={15} /> },
            { label: "Needs fix", value: counts.needs_fix ?? 0, icon: <AlertTriangle size={15} /> },
            { label: "Gold profiled", value: counts.gold_profiled ?? 0, icon: <FlaskConical size={15} /> },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-background px-4 py-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{item.label}</span>
                {item.icon}
              </div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(item.value)}</div>
            </div>
          ))}
        </section>

        <section className="mb-4 grid grid-cols-[1.5fr_13rem_12rem] gap-3">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search measure, metric, dataset..." />
          <Select value={domain} onValueChange={setDomain}>
            <SelectTrigger><SelectValue placeholder="Domain" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All domains</SelectItem>
              <SelectItem value="bouwen-en-wonen">Bouwen en wonen</SelectItem>
              <SelectItem value="inkomen-en-bestedingen">Inkomen en bestedingen</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Approval" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="under_review">Under review</SelectItem>
              <SelectItem value="needs_fix">Needs fix</SelectItem>
              <SelectItem value="profiled">Profiled</SelectItem>
              <SelectItem value="gold_profiled">Gold profiled</SelectItem>
            </SelectContent>
          </Select>
        </section>

        {error && <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</div>}

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(42rem,1fr)_31rem] gap-4">
          <section className="min-h-0 overflow-hidden rounded-lg border border-border bg-background">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Semantic Values From Gold</h2>
              <p className="text-xs text-muted-foreground">One row per profiled Gold measure capability across Bouwen en wonen and Inkomen en bestedingen.</p>
            </div>
            <div className="h-[calc(100%-57px)] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%] pl-4">Measure</TableHead>
                    <TableHead>Dataset</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Years</TableHead>
                    <TableHead>Levels</TableHead>
                    <TableHead className="text-right pr-4">Rows</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(catalogue?.items ?? []).map((item) => (
                    <TableRow
                      key={itemKey(item)}
                      data-state={itemKey(item) === itemKey(selectedItem ?? item) ? "selected" : undefined}
                      className="cursor-pointer"
                      onClick={() => setSelectedKey(itemKey(item))}
                    >
                      <TableCell className="pl-4">
                        <div className="max-w-[24rem] truncate font-medium text-foreground">{item.measure_name}</div>
                        <div className="max-w-[24rem] truncate text-xs text-muted-foreground">{item.metric_code ?? item.measure_code ?? item.measure_key}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{item.dataset_code}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.domain_id}</TableCell>
                      <TableCell><StatusBadge value={item.approval_status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.min_year ?? "?"}-{item.max_year ?? "?"}</TableCell>
                      <TableCell className="max-w-[12rem] truncate text-xs text-muted-foreground">{item.geography_types?.join(", ")}</TableCell>
                      <TableCell className="pr-4 text-right text-muted-foreground">{formatNumber(item.populated_fact_rows)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {catalogue?.items.length === 0 && (
                <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                  No semantic values match the current filters. Refresh the Gold capability registry if new facts were loaded.
                </div>
              )}
            </div>
          </section>

          <aside className="min-h-0 overflow-y-auto rounded-lg border border-border bg-background">
            {selectedItem ? (
              <div className="space-y-5 p-5">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <StatusBadge value={selectedItem.approval_status} />
                    {selectedItem.execution_status && <Badge variant="outline">{selectedItem.execution_status}</Badge>}
                    {selectedItem.metadata_origin && <Badge variant="outline">{selectedItem.metadata_origin}</Badge>}
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">{selectedItem.measure_name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedItem.dataset_code} · {selectedItem.dataset_title ?? "Untitled dataset"}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Info label="Metric code" value={selectedItem.metric_code ?? "not promoted"} />
                  <Info label="Measure key" value={String(selectedItem.measure_key)} />
                  <Info label="Unit" value={`${selectedItem.unit_code ?? "unknown"} ${selectedItem.unit_name ? `· ${selectedItem.unit_name}` : ""}`} />
                  <Info label="Aggregation" value={selectedItem.default_aggregation ?? "none"} />
                  <Info label="Years" value={`${selectedItem.min_year ?? "?"}-${selectedItem.max_year ?? "?"}`} />
                  <Info label="Gold rows" value={formatNumber(selectedItem.populated_fact_rows)} />
                </div>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Approval Explanation</h3>
                  <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                    {selectedItem.approval_status === "approved" && "Approved means this metric has a reviewed or curated semantic contract and is enabled for the investigation engine."}
                    {selectedItem.approval_status === "under_review" && "Under review means Guara profiled this metric and generated a candidate contract, but it is still blocked from execution until promoted."}
                    {selectedItem.approval_status === "needs_fix" && "Needs fix means blocking diagnostics were found, such as unsafe aggregation, missing unit metadata, or incomplete grain support."}
                    {selectedItem.approval_status === "gold_profiled" && "Gold profiled means the measure exists in the Gold mart and has capability metadata, but no semantic contract has been reviewed yet."}
                    {!["approved", "under_review", "needs_fix", "gold_profiled"].includes(selectedItem.approval_status) && "This metric has semantic metadata, but it is not yet approved for deterministic investigation answers."}
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Connected Dimensional Values</h3>
                  {isDetailLoading ? (
                    <p className="text-sm text-muted-foreground">Loading dimensions...</p>
                  ) : dimensions.length ? (
                    <div className="space-y-3">
                      {dimensions.map((dimension) => (
                        <div key={dimension} className="rounded-md border border-border">
                          <div className="border-b border-border px-3 py-2 text-sm font-medium text-foreground">{dimension}</div>
                          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto p-2">
                            {dimensionGroups[dimension].map((value) => (
                              <button
                                key={`${dimension}:${value.category_code ?? value.category_name}`}
                                type="button"
                                onClick={() => setCategoryFilters((current) => ({ ...current, [dimension]: value.category_code ?? value.category_name }))}
                                className={cn(
                                  "rounded-md border px-2 py-1 text-xs transition",
                                  categoryFilters[dimension] === (value.category_code ?? value.category_name)
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                                )}
                                title={`${value.category_name} · ${formatNumber(value.row_count)} rows`}
                              >
                                {value.category_name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No category dimensions found for this measure.</p>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Aggregation Sandbox</h3>
                  <div className="space-y-2 rounded-md border border-border bg-card p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={year} onValueChange={setYear}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="latest">Latest year</SelectItem>
                          {selectedYearOptions.map((option) => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={geographyType} onValueChange={setGeographyType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All levels</SelectItem>
                          {selectedGeographyOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={aggregation} onValueChange={setAggregation}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sum">Sum</SelectItem>
                          <SelectItem value="average">Average</SelectItem>
                          <SelectItem value="min">Min</SelectItem>
                          <SelectItem value="max">Max</SelectItem>
                          <SelectItem value="count">Count rows</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={groupDimension} onValueChange={setGroupDimension}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No category grouping</SelectItem>
                          {dimensions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(categoryFilters).map(([dimension, value]) => (
                        <button
                          key={dimension}
                          type="button"
                          onClick={() => setCategoryFilters((current) => {
                            const next = { ...current };
                            delete next[dimension];
                            return next;
                          })}
                          className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-primary"
                        >
                          {dimension}: {value} ×
                        </button>
                      ))}
                    </div>
                    <Button size="sm" onClick={runSandbox} disabled={isSandboxLoading}>
                      <Play size={13} />
                      {isSandboxLoading ? "Running..." : "Run aggregation"}
                    </Button>
                  </div>
                </section>

                {sandbox && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">Sandbox Result</h3>
                    <div className="max-h-72 overflow-auto rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-3">Geography</TableHead>
                            <TableHead>Year</TableHead>
                            <TableHead>Group</TableHead>
                            <TableHead className="text-right pr-3">Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sandbox.rows.map((row, index) => (
                            <TableRow key={`${row.geography_code}:${row.group_value}:${index}`}>
                              <TableCell className="pl-3">{row.geography_name ?? row.geography_code ?? "Unknown"}</TableCell>
                              <TableCell>{row.calendar_year}</TableCell>
                              <TableCell>{row.group_value ?? "-"}</TableCell>
                              <TableCell className="pr-3 text-right">{formatValue(row.aggregate_value)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Sample Gold Rows</h3>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {(detail?.sampleRows ?? []).map((row, index) => (
                      <div key={`${row.category_combination_hash}:${index}`} className="rounded-md border border-border px-3 py-2 text-xs">
                        <div className="font-medium text-foreground">{row.geography_name ?? row.geography_code} · {row.calendar_year} · {formatValue(row.observation_value)}</div>
                        <div className="mt-1 text-muted-foreground">{Object.entries(row.categories ?? {}).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No categories"}</div>
                      </div>
                    ))}
                    {!detail?.sampleRows?.length && <p className="text-sm text-muted-foreground">No sample rows available.</p>}
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Metadata</h3>
                  <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">{jsonText({
                    source: {
                      system: selectedItem.source_system,
                      organization: selectedItem.source_organization,
                      url: selectedItem.source_url,
                      source_last_updated: selectedItem.last_updated_at_source,
                      gold_loaded_at: selectedItem.gold_loaded_at,
                    },
                    capability: {
                      executable_candidate: selectedItem.executable_candidate,
                      non_executable_reasons: selectedItem.non_executable_reasons,
                      grains: selectedItem.grains,
                      geography_types: selectedItem.geography_types,
                      supports: {
                        ranking: selectedItem.supports_ranking,
                        trend: selectedItem.supports_trend,
                        comparison: selectedItem.supports_comparison,
                      },
                    },
                    semantic: {
                      metric_code: selectedItem.metric_code,
                      contract_status: selectedItem.contract_status,
                      execution_status: selectedItem.execution_status,
                      quality: selectedItem.semantic_quality_status,
                      metadata_origin: selectedItem.metadata_origin,
                      review_status: selectedItem.review_status,
                      risk_level: selectedItem.risk_level,
                    },
                    raw_metadata: selectedItem.metadata,
                  })}</pre>
                </section>
              </div>
            ) : (
              <div className="p-5 text-sm text-muted-foreground">Select a semantic value to inspect it.</div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
