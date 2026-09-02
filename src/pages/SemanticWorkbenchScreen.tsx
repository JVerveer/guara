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

function listText(values: unknown) {
  if (!Array.isArray(values) || values.length === 0) return "None";
  return values.map((value) => String(value)).join(", ");
}

function percentText(value: unknown) {
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || Number.isNaN(number)) return "unknown";
  return `${Math.round(number * 100)}%`;
}

function formatLevel(value: string) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "neighborhood") return "Wijk/buurt";
  if (normalized === "municipality") return "Gemeente";
  if (normalized === "corop") return "COROP-gebied";
  if (normalized === "province") return "Provincie";
  if (normalized === "landsdeel") return "Landsdeel";
  if (normalized === "country" || normalized === "national" || normalized === "totaal" || normalized === "unknown") return "Totaal (Nederland)";
  if (normalized === "region") return "Regionaal";
  return value.replace(/_/g, " ");
}

function geographyLevelOrder(value: string) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "neighborhood") return 0;
  if (normalized === "municipality") return 1;
  if (normalized === "corop" || normalized === "region") return 2;
  if (normalized === "province") return 3;
  if (normalized === "landsdeel") return 4;
  if (normalized === "country" || normalized === "national" || normalized === "totaal" || normalized === "unknown") return 5;
  return 99;
}

function formatLevels(item: Pick<SemanticCatalogueItem, "grains" | "geography_types">) {
  const levels = item.grains?.length
    ? item.grains
    : item.geography_types?.map((level) => `${level}_year`) ?? [];
  return levels.length ? levels.map(formatLevel).join(", ") : "Not profiled";
}

function formatCoverage(item: Pick<SemanticCatalogueItem, "fact_row_count_status" | "populated_fact_rows">) {
  if (item.fact_row_count_status === "counted") return `${formatNumber(item.populated_fact_rows)} rows`;
  if (item.fact_row_count_status === "available_not_counted") return "Available";
  return "No facts found";
}

function formatTopicPath(item: Pick<SemanticCatalogueItem, "topic" | "subtopic">) {
  return [item.topic, item.subtopic].filter(Boolean).join(" / ") || "No CBS topic path";
}

function dimensionValueTitle(value: SemanticDimensionValue) {
  if (value.row_count > 0) return `${value.category_name} · ${formatNumber(value.row_count)} reported rows`;
  return `${value.category_name} · metadata value`;
}

function filterDimensionValues(values: SemanticDimensionValue[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return values;
  return values.filter((value) =>
    [value.category_name, value.category_code ?? ""].some((candidate) => candidate.toLowerCase().includes(normalized))
  );
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

const BUILT_IN_DIMENSIONS = new Set(["calendar_year", "period_code", "geography_type"]);

function normalizedDimensionSelection(dimension: string, value: SemanticDimensionValue) {
  if (dimension === "calendar_year") {
    const parsedYear = value.min_year ?? Number(String(value.category_code ?? value.category_name).slice(0, 4));
    return Number.isFinite(parsedYear) ? String(parsedYear) : String(value.category_name);
  }
  if (dimension === "period_code") return value.category_code ?? value.category_name;
  return value.category_code ?? value.category_name;
}

function appliedFilterLabel(dimension: string, value: string) {
  if (dimension === "calendar_year") return "Year";
  if (dimension === "period_code") return "Period";
  if (dimension === "geography_type") return "Level";
  return dimension;
}

function contractAggregation(item: SemanticCatalogueItem | null) {
  if (!item) return "sum";
  if (item.default_aggregation && item.default_aggregation !== "none") return item.default_aggregation;
  if (item.is_non_additive) return "average";
  return "sum";
}

function inferPeriodGrain(periodCode: string, year: string) {
  if (periodCode !== "all") {
    const normalized = periodCode.toUpperCase();
    if (normalized.includes("KW")) return "quarter";
    if (normalized.includes("MM")) return "month";
    if (normalized.includes("JJ")) return "year";
    return "period";
  }
  return year === "latest" ? "latest annual year" : "year";
}

function isTotalDimensionValue(value: SemanticDimensionValue) {
  const code = String(value.category_code ?? "").trim().toUpperCase();
  const name = String(value.category_name ?? "").trim().toLowerCase();
  return value.is_total === true || code.startsWith("T") || name === "totaal" || name === "total" || name.endsWith(" totaal") || name.endsWith(" total");
}

function preferredTotalValue(values: SemanticDimensionValue[]) {
  return values
    .filter(isTotalDimensionValue)
    .sort((a, b) => {
      const aCode = String(a.category_code ?? "").trim().toUpperCase();
      const bCode = String(b.category_code ?? "").trim().toUpperCase();
      const aOfficial = aCode.startsWith("T") ? 0 : 1;
      const bOfficial = bCode.startsWith("T") ? 0 : 1;
      if (aOfficial !== bOfficial) return aOfficial - bOfficial;
      return a.category_name.length - b.category_name.length || a.category_name.localeCompare(b.category_name);
    })[0] ?? null;
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
  const [periodCode, setPeriodCode] = useState("all");
  const [geographyType, setGeographyType] = useState("municipality");
  const [categoryFilters, setCategoryFilters] = useState<Record<string, string[]>>({});
  const [dimensionSearch, setDimensionSearch] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSandboxLoading, setIsSandboxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => catalogue?.items.find((item) => itemKey(item) === selectedKey) ?? catalogue?.items[0] ?? null,
    [catalogue?.items, selectedKey]
  );
  const aggregation = useMemo(() => contractAggregation(selectedItem), [selectedItem]);

  const dimensionGroups = useMemo(() => valuesByDimension(detail?.dimensionValues ?? []), [detail?.dimensionValues]);
  const dimensions = useMemo(() => Object.keys(dimensionGroups).sort(), [dimensionGroups]);
  const categoryDimensions = useMemo(() => dimensions.filter((dimension) => !BUILT_IN_DIMENSIONS.has(dimension)), [dimensions]);
  const selectedGeographyOptions = selectedItem?.geography_types?.length
    ? selectedItem.geography_types.filter((value) => value && value !== "unknown")
      .sort((a, b) => geographyLevelOrder(a) - geographyLevelOrder(b))
    : [];
  const hasGeographyGrain = selectedGeographyOptions.length > 0;
  const selectedSliceMaxYear = useMemo(() => {
    const years = (dimensionGroups.calendar_year ?? [])
      .map((value) => value.min_year ?? Number(value.category_code ?? value.category_name))
      .filter((value) => Number.isFinite(value));
    return years.length ? Math.max(...years) : selectedItem?.max_year ?? null;
  }, [dimensionGroups.calendar_year, selectedItem?.max_year]);
  const activePeriodGrain = useMemo(() => inferPeriodGrain(periodCode, year), [periodCode, year]);
  const activeGeographyLevel = hasGeographyGrain ? (geographyType === "all" ? "all available levels" : formatLevel(geographyType)) : "not applicable";
  const activeDisplayGrain = hasGeographyGrain
    ? `${geographyType === "all" ? "selected geography" : formatLevel(geographyType)} / ${activePeriodGrain}`
    : activePeriodGrain;

  const clearDimensionFilter = (dimension: string) => {
    if (dimension === "calendar_year") {
      setYear("latest");
      return;
    }
    if (dimension === "period_code") {
      setPeriodCode("all");
      return;
    }
    if (dimension === "geography_type") {
      setGeographyType(hasGeographyGrain ? selectedGeographyOptions[0] ?? "all" : "all");
      return;
    }
    setCategoryFilters((current) => {
      const next = { ...current };
      delete next[dimension];
      return next;
    });
  };

  const isDimensionFiltered = (dimension: string) => {
    if (dimension === "calendar_year") return year !== "latest";
    if (dimension === "period_code") return periodCode !== "all";
    if (dimension === "geography_type") return hasGeographyGrain && geographyType !== "all";
    return Boolean(categoryFilters[dimension]?.length);
  };

  const dimensionDisplayValue = (dimension: string, rawValue: string) => {
    const match = dimensionGroups[dimension]?.find((value) =>
      normalizedDimensionSelection(dimension, value) === rawValue || (value.category_code ?? value.category_name) === rawValue
    );
    return match?.category_name ?? rawValue;
  };

  const totalRowBehaviors = useMemo(() => categoryDimensions.map((dimension) => {
    const selectedValues = categoryFilters[dimension] ?? [];
    const selectedLabels = selectedValues.map((value) => dimensionDisplayValue(dimension, value));
    const totalValue = preferredTotalValue(dimensionGroups[dimension] ?? []);
    return {
      dimension,
      behavior: selectedValues.length
        ? `Explicit filter: ${selectedLabels.join(", ")}`
        : totalValue
          ? `Unfiltered: uses official total row "${totalValue.category_name}"`
          : "Unfiltered: no official total row found, so aggregation may include all values",
      isSafe: selectedValues.length > 0 || Boolean(totalValue),
    };
  }), [categoryDimensions, categoryFilters, dimensionGroups]);

  const appliedFilters = useMemo(() => {
    const filters = [
      {
        dimension: "calendar_year",
        value: year === "latest" ? `latest available${selectedSliceMaxYear ? ` (${selectedSliceMaxYear})` : ""}` : year,
        removable: year !== "latest",
      },
    ];

    if (hasGeographyGrain) {
      filters.push({
        dimension: "geography_type",
        value: geographyType === "all" ? "all levels" : formatLevel(geographyType),
        removable: geographyType !== "all",
      });
    }

    if (periodCode !== "all") {
      filters.push({
        dimension: "period_code",
        value: dimensionDisplayValue("period_code", periodCode),
        removable: true,
      });
    }

    Object.entries(categoryFilters).forEach(([dimension, values]) => {
      if (!values.length) return;
      filters.push({ dimension, value: values.map((value) => dimensionDisplayValue(dimension, value)).join(", "), removable: true });
    });

    return filters;
  }, [categoryFilters, dimensionGroups, geographyType, hasGeographyGrain, periodCode, selectedSliceMaxYear, year]);

  const selectDimensionValue = (dimension: string, value: SemanticDimensionValue) => {
    const selectedValue = normalizedDimensionSelection(dimension, value);
    if (dimension === "calendar_year") {
      setYear(selectedValue);
      return;
    }
    if (dimension === "period_code") {
      setPeriodCode(selectedValue);
      const parsedYear = Number(String(selectedValue).slice(0, 4));
      if (Number.isFinite(parsedYear)) setYear(String(parsedYear));
      return;
    }
    if (dimension === "geography_type") {
      setGeographyType(selectedValue);
      return;
    }
    setCategoryFilters((current) => {
      const existing = current[dimension] ?? [];
      const nextValues = existing.includes(selectedValue)
        ? existing.filter((value) => value !== selectedValue)
        : [...existing, selectedValue];
      const next = { ...current };
      if (nextValues.length) next[dimension] = nextValues;
      else delete next[dimension];
      return next;
    });
  };

  const loadCatalogue = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await semanticWorkbenchService.fetchCatalogue({ domain, status, query: search, limit: 5000 });
      setCatalogue(result);
      setSelectedKey((current) => current && result.items.some((item) => itemKey(item) === current) ? current : itemKey(result.items[0] ?? { domain_id: "", dataset_code: "", measure_key: "" }));
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
    setDimensionSearch({});
    setYear("latest");
    setPeriodCode("all");
    const geographyOptions = selectedItem.geography_types?.filter((value) => value && value !== "unknown") ?? [];
    const defaultGeographyType = geographyOptions.includes("municipality") ? "municipality" : geographyOptions[0] ?? "all";
    setGeographyType(defaultGeographyType);

    const loadDetail = async () => {
      setIsDetailLoading(true);
      try {
        setDetail(await semanticWorkbenchService.fetchMetricDetail(selectedItem, {
          geographyType: defaultGeographyType !== "all" ? defaultGeographyType : null,
          categoryFilters: {},
        }));
      } catch (detailError) {
        setError(detailError instanceof Error ? detailError.message : String(detailError));
      } finally {
        setIsDetailLoading(false);
      }
    };
    void loadDetail();
  }, [selectedItem?.domain_id, selectedItem?.dataset_code, selectedItem?.measure_key]);

  useEffect(() => {
    if (!selectedItem || isDetailLoading) return;
    const timeout = window.setTimeout(() => {
      const refreshDetail = async () => {
        try {
          setDetail(await semanticWorkbenchService.fetchMetricDetail(selectedItem, {
            year: year === "latest" ? null : Number(year),
            periodCode: periodCode === "all" ? null : periodCode,
            geographyType: hasGeographyGrain ? geographyType : null,
            categoryFilters,
          }));
        } catch (detailError) {
          setError(detailError instanceof Error ? detailError.message : String(detailError));
        }
      };
      void refreshDetail();
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [categoryFilters, geographyType, hasGeographyGrain, periodCode, selectedItem?.domain_id, selectedItem?.dataset_code, selectedItem?.measure_key, year]);

  useEffect(() => {
    if (!detail?.dimensionValues.length) return;
    setCategoryFilters((current) => {
      let changed = false;
      const next: Record<string, string[]> = {};

      for (const [dimension, selectedValues] of Object.entries(current)) {
        const availableValues = new Set(
          (dimensionGroups[dimension] ?? []).map((value) => normalizedDimensionSelection(dimension, value))
        );
        const retainedValues = selectedValues.filter((value) => availableValues.has(value));
        if (retainedValues.length !== selectedValues.length) changed = true;
        if (retainedValues.length) next[dimension] = retainedValues;
      }

      return changed ? next : current;
    });
  }, [detail?.dimensionValues, dimensionGroups]);

  const runSandbox = async () => {
    if (!selectedItem) return;
    setIsSandboxLoading(true);
    setError(null);
    try {
      setSandbox(await semanticWorkbenchService.runAggregationSandbox({
        item: selectedItem,
        year: year === "latest" ? selectedSliceMaxYear : Number(year),
        periodCode: periodCode === "all" ? null : periodCode,
        geographyType: hasGeographyGrain ? geographyType : null,
        aggregation,
        categoryFilters,
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
                    <TableHead className="text-right pr-4">Coverage</TableHead>
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
                        <div className="max-w-[24rem] truncate text-[11px] text-muted-foreground" title={formatTopicPath(item)}>{formatTopicPath(item)}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{item.dataset_code}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.domain_id}</TableCell>
                      <TableCell><StatusBadge value={item.approval_status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.min_year ?? "?"}-{item.max_year ?? "?"}</TableCell>
                      <TableCell className="max-w-[14rem] truncate text-xs text-muted-foreground" title={formatLevels(item)}>{formatLevels(item)}</TableCell>
                      <TableCell className="pr-4 text-right text-muted-foreground" title={item.fact_row_count_status === "counted" ? "Real counted non-missing Gold fact rows." : "This measure has Gold coverage, but exact rows were not counted in the lightweight Workbench profile."}>
                        {formatCoverage(item)}
                      </TableCell>
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
                  <Info label="Levels" value={formatLevels(selectedItem)} />
                  <Info label="Coverage" value={formatCoverage(selectedItem)} />
                </div>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Source Semantic Context</h3>
                  <div className="rounded-md border border-border bg-card p-3 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <Info label="CBS topic" value={selectedItem.topic ?? "unknown"} />
                      <Info label="CBS subtopic" value={selectedItem.subtopic ?? "unknown"} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      This context disambiguates duplicate CBS labels. For example, the same label can appear under different topic groups such as primary income versus all incomes.
                    </p>
                  </div>
                </section>

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
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Active Query Contract</h3>
                  <div className="space-y-3 rounded-md border border-border bg-card p-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <Info label="Active grain" value={activeDisplayGrain} />
                      <Info label="Period grain" value={activePeriodGrain} />
                      <Info label="Geography level" value={activeGeographyLevel} />
                      <Info label="Aggregation" value={aggregation} />
                    </div>

                    <div>
                      <div className="mb-1 text-xs font-medium text-foreground">Category filters</div>
                      {Object.keys(categoryFilters).length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(categoryFilters).map(([dimension, values]) => (
                            <span key={dimension} className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-primary">
                              {dimension}: {values.map((value) => dimensionDisplayValue(dimension, value)).join(", ")}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-md border border-border bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                          No category filters selected. Guara will collapse category dimensions to official total rows where CBS provides them.
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="mb-1 text-xs font-medium text-foreground">Total-row behavior</div>
                      {totalRowBehaviors.length ? (
                        <div className="space-y-1.5">
                          {totalRowBehaviors.map((item) => (
                            <div
                              key={item.dimension}
                              className={cn(
                                "rounded-md border px-2 py-1.5 text-xs",
                                item.isSafe
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : "border-amber-200 bg-amber-50 text-amber-800"
                              )}
                            >
                              <span className="font-medium">{item.dimension}</span>: {item.behavior}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-md border border-border bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                          This measure has no category dimensions in the current selection.
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">AI Semantic Review</h3>
                  {detail?.aiReview ? (
                    <div className="space-y-3 rounded-md border border-border bg-card p-3">
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge value={detail.aiReview.review_status} />
                        <Badge variant="outline">{percentText(detail.aiReview.confidence)} confidence</Badge>
                        <Badge variant="outline">{detail.aiReview.recommended_action.replace(/_/g, " ")}</Badge>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{detail.aiReview.business_label ?? selectedItem.measure_name}</div>
                        <p className="mt-1 text-sm text-muted-foreground">{detail.aiReview.plain_definition ?? "No plain-language definition generated yet."}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <Info label="Metric type" value={detail.aiReview.metric_type ?? "unknown"} />
                        <Info label="Recommended aggregation" value={detail.aiReview.recommended_aggregation ?? "unknown"} />
                        <Info label="Aggregation class" value={detail.aiReview.aggregation_classification ?? "unknown"} />
                        <Info label="Additive" value={detail.aiReview.is_additive === null ? "unknown" : detail.aiReview.is_additive ? "yes" : "no"} />
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div><span className="font-medium text-foreground">NL synonyms:</span> {listText((detail.aiReview.synonyms as { nl?: string[] })?.nl)}</div>
                        <div><span className="font-medium text-foreground">EN synonyms:</span> {listText((detail.aiReview.synonyms as { en?: string[] })?.en)}</div>
                        <div><span className="font-medium text-foreground">Exclusions:</span> {listText(detail.aiReview.exclusions)}</div>
                        <div><span className="font-medium text-foreground">Caveats:</span> {listText(detail.aiReview.caveats)}</div>
                        <div><span className="font-medium text-foreground">Risk flags:</span> {listText(detail.aiReview.risk_flags)}</div>
                      </div>
                      {detail.aiReview.rationale && (
                        <p className="rounded-md border border-border bg-muted p-2 text-xs text-muted-foreground">{detail.aiReview.rationale}</p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                      No AI semantic review generated yet. Run <span className="font-mono text-xs">npm run review:semantic:ai</span> after setting an OpenAI API key, or use the local fallback mode for an initial pass.
                    </div>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Connected Dimensional Values</h3>
                  {isDetailLoading ? (
                    <p className="text-sm text-muted-foreground">Loading dimensions...</p>
                  ) : dimensions.length ? (
                    <div className="space-y-3">
                      {dimensions.map((dimension) => {
                        const visibleValues = filterDimensionValues(dimensionGroups[dimension], dimensionSearch[dimension] ?? "");
                        return (
                          <div key={dimension} className="rounded-md border border-border">
                            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                              <div>
                                <div className="text-sm font-medium text-foreground">{dimension}</div>
                                <div className="text-[11px] text-muted-foreground">{formatNumber(dimensionGroups[dimension].length)} values</div>
                              </div>
                              {isDimensionFiltered(dimension) && (
                                <button
                                  type="button"
                                  onClick={() => clearDimensionFilter(dimension)}
                                  className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-primary"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                            {dimensionGroups[dimension].length > 12 && (
                              <div className="border-b border-border p-2">
                                <Input
                                  value={dimensionSearch[dimension] ?? ""}
                                  onChange={(event) => setDimensionSearch((current) => ({ ...current, [dimension]: event.target.value }))}
                                  placeholder={`Search ${dimension} values...`}
                                  className="h-8 text-xs"
                                />
                              </div>
                            )}
                            <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto p-2">
                              {visibleValues.map((value) => (
                                <button
                                  key={`${dimension}:${value.category_code ?? value.category_name}`}
                                  type="button"
                                  onClick={() => selectDimensionValue(dimension, value)}
                                  className={cn(
                                    "rounded-md border px-2 py-1 text-xs transition",
                                    (dimension === "calendar_year" && year === normalizedDimensionSelection(dimension, value))
                                    || (dimension === "period_code" && periodCode === normalizedDimensionSelection(dimension, value))
                                    || (dimension === "geography_type" && geographyType === normalizedDimensionSelection(dimension, value))
                                    || (categoryFilters[dimension] ?? []).includes(normalizedDimensionSelection(dimension, value))
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                                  )}
                                  title={dimensionValueTitle(value)}
                                >
                                  {value.category_name}
                                </button>
                              ))}
                              {visibleValues.length === 0 && (
                                <p className="px-1 py-2 text-xs text-muted-foreground">No values match this filter.</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No dimensional values found for this measure.</p>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Aggregation Sandbox</h3>
                  <div className="space-y-2 rounded-md border border-border bg-card p-3">
                    <div>
                      <div className="mb-1 text-xs font-medium text-foreground">Applied filters</div>
                      <div className="flex flex-wrap gap-1.5">
                        {appliedFilters.map((filter) => (
                          <button
                            key={`${filter.dimension}:${filter.value}`}
                            type="button"
                            onClick={() => filter.removable && clearDimensionFilter(filter.dimension)}
                            className={cn(
                              "rounded-md border px-2 py-1 text-xs",
                              filter.removable
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "border-border bg-muted text-muted-foreground"
                            )}
                          >
                            {appliedFilterLabel(filter.dimension, filter.value)}: {filter.value}{filter.removable ? " x" : ""}
                          </button>
                        ))}
                        {!hasGeographyGrain && (
                          <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
                            Level: not applicable
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Contract aggregation</div>
                        <div className="mt-0.5 font-medium text-foreground">{aggregation}</div>
                      </div>
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
                    {sandbox.rows.length ? (
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
                    ) : (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        No reported numeric rows match the current sandbox filters. The combination may exist in CBS, but missing or suppressed observations are excluded from aggregations.
                      </div>
                    )}
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

                {sandbox?.sql && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">Generated SQL</h3>
                    <div className="rounded-md border border-border bg-card">
                      <div className="flex items-center justify-between border-b border-border px-3 py-2">
                        <span className="text-xs text-muted-foreground">Runnable Supabase SQL for the current sandbox selection</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void navigator.clipboard.writeText(sandbox.sql ?? "")}
                        >
                          Copy SQL
                        </Button>
                      </div>
                      <pre className="max-h-72 overflow-auto p-3 text-xs text-muted-foreground">{sandbox.sql}</pre>
                    </div>
                  </section>
                )}

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
                      topic: selectedItem.topic,
                      subtopic: selectedItem.subtopic,
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
