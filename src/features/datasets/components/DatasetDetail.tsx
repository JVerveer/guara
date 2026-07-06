import { useEffect, useState } from "react";
import {
  Bookmark,
  Check,
  Copy,
  Download,
  ExternalLink,
  GitBranch,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { fonts } from "@/theme/tokens";
import { ProviderBadge } from "@/components/ui/ProviderBadge";
import { datasetService } from "../services/datasetService";
import type { DatasetPreviewRow, DatasetVariable } from "../types";

type Tab = "preview" | "metadata" | "variables" | "api";

const API_ENDPOINT = "https://opendata.cbs.nl/ODataApi/odata/85039NED/TypedDataSet";

const CODE_SNIPPET = `import cbsodata

# Fetch kerncijfers for Amsterdam (GM0363)
data = cbsodata.get_data(
    '85039NED',
    filters="RegioS eq 'GM0363'",
    select=[
        'BevolkingAantalInwoners',
        'GemiddeldinkomenperpersoonEuro',
    ]
)`;

const METADATA_KEYS = [
  { labelKey: "datasets.metadata.datasetId", value: "85039NED" },
  { labelKey: "datasets.metadata.publisher", value: "Centraal Bureau voor de Statistiek (CBS)" },
  { labelKey: "datasets.metadata.language", value: "Dutch (NL)" },
  { labelKey: "datasets.metadata.spatialCoverage", value: "Netherlands — all municipalities, wijken and buurten" },
  { labelKey: "datasets.metadata.temporalCoverage", value: "2015–2023 (annual)" },
  { labelKey: "datasets.metadata.license", value: "Creative Commons Attribution 4.0 (CC BY 4.0)" },
  { labelKey: "datasets.metadata.updateFrequency", value: "Annual" },
  { labelKey: "datasets.metadata.format", value: "JSON, CSV, Excel" },
  { labelKey: "datasets.metadata.catalogUrl", value: "opendata.cbs.nl" },
] as const;

const TABLE_HEADER_KEYS = [
  "datasets.table.municipality",
  "datasets.table.year",
  "datasets.table.population",
  "datasets.table.avgIncome",
  "datasets.table.avgWoz",
] as const;

export function DatasetDetail() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("preview");
  const [copied, setCopied] = useState(false);
  const [previewRows, setPreviewRows] = useState<DatasetPreviewRow[]>([]);
  const [variables, setVariables] = useState<DatasetVariable[]>([]);
  const [isLoadingApiData, setIsLoadingApiData] = useState(true);

  const locale = i18n.language.startsWith("nl") ? "nl-NL" : "en-GB";
  const formatInt = (n: number) => new Intl.NumberFormat(locale).format(n);
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);

  const suggestedJoins = datasetService.getDetailSuggestedJoins();
  const statsKeys = [
    { key: "datasets.stats.records", value: String(previewRows.length) },
    { key: "datasets.stats.topics", value: String(variables.length) },
    { key: "datasets.stats.variables", value: String(variables.length) },
    { key: "datasets.stats.period", value: "2021" },
    { key: "datasets.stats.format", value: "JSON" },
    { key: "datasets.stats.reliability", value: "CBS API" },
  ] as const;

  useEffect(() => {
    let cancelled = false;
    setIsLoadingApiData(true);

    Promise.all([datasetService.getDetailPreviewRows(), datasetService.getDetailVariables()])
      .then(([rows, nextVariables]) => {
        if (cancelled) return;
        setPreviewRows(rows);
        setVariables(nextVariables);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingApiData(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const TABS: { id: Tab; labelKey: string }[] = [
    { id: "preview", labelKey: "datasets.tabs.preview" },
    { id: "metadata", labelKey: "datasets.tabs.metadata" },
    { id: "variables", labelKey: "datasets.tabs.variables" },
    { id: "api", labelKey: "datasets.tabs.api" },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(API_ENDPOINT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-8 py-10 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                <ProviderBadge name="CBS" />
                <span>{t("common.lastUpdated")}: CBS API</span>
                <span>·</span>
                <span>{t("sources.coverage")}: All 342 municipalities</span>
                <span>·</span>
                <span>CC BY 4.0</span>
              </div>
              <h1
                className="text-[28px] text-foreground leading-tight"
                style={{ fontFamily: fonts.display, fontWeight: 400 }}
              >
                Kerncijfers wijken en buurten
              </h1>
              <p className="text-[14px] text-muted-foreground leading-relaxed max-w-2xl">
                Live CBS StatLine data for Dutch municipalities, neighborhoods (wijken) and
                districts (buurten), loaded from the Open Data v3 API.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Bookmark size={13} />
                {t("common.save")}
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                <Zap size={13} />
                {t("research.useInResearch")}
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-6 gap-4 p-4 bg-muted rounded-xl">
            {statsKeys.map(({ key, value }) => (
              <div key={key}>
                <p className="text-[10px] text-muted-foreground">{t(key)}</p>
                <p className="text-[14px] font-semibold text-foreground tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <div className="flex gap-0">
            {TABS.map(({ id, labelKey }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  activeTab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {activeTab === "preview" && (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {TABLE_HEADER_KEYS.map((key) => (
                      <th
                        key={key}
                        className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide"
                      >
                        {t(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoadingApiData && (
                    <tr>
                      <td className="px-4 py-3 text-muted-foreground" colSpan={TABLE_HEADER_KEYS.length}>
                        {t("common.loading")}
                      </td>
                    </tr>
                  )}
                  {!isLoadingApiData && previewRows.map((r, i) => (
                    <tr
                      key={i}
                      className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{r.muni}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">{r.year}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">
                        {formatInt(r.pop)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">
                        {formatCurrency(r.income)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">
                        {formatCurrency(r.woz)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("datasets.showingRecords", { total: formatInt(previewRows.length) })}
            </p>
          </div>
        )}

        {/* Metadata */}
        {activeTab === "metadata" && (
          <div className="divide-y divide-border">
            {METADATA_KEYS.map(({ labelKey, value }) => (
              <div key={labelKey} className="flex items-start gap-6 py-3">
                <span className="text-[12px] font-medium text-muted-foreground w-48 flex-shrink-0 pt-0.5">
                  {t(labelKey)}
                </span>
                <span className="text-[13px] text-foreground">{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Variables */}
        {activeTab === "variables" && (
          <div className="space-y-2">
            {variables.map((v) => (
              <div
                key={v.name}
                className="flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-lg"
              >
                <code
                  className="text-[12px] font-medium text-primary w-80 flex-shrink-0 truncate"
                  style={{ fontFamily: fonts.mono }}
                >
                  {v.name}
                </code>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0"
                  style={{ fontFamily: fonts.mono }}
                >
                  {v.type}
                </span>
                <span className="text-[12px] text-muted-foreground truncate">
                  {datasetService.getVariableDescription(v.descKey)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* API */}
        {activeTab === "api" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
                {t("datasets.api.endpoint")}
              </h3>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border">
                <code
                  className="flex-1 text-[12px] text-foreground truncate"
                  style={{ fontFamily: fonts.mono }}
                >
                  {API_ENDPOINT}
                </code>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                >
                  {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  {copied ? t("common.copied") : t("common.copy")}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
                {t("datasets.api.exampleTitle")}
              </h3>
              <div className="relative bg-[#0D1117] rounded-xl overflow-hidden border border-border">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
                  <span className="text-[11px] text-white/40" style={{ fontFamily: fonts.mono }}>
                    example.py
                  </span>
                  <button className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors">
                    <Copy size={11} />
                    {t("common.copy")}
                  </button>
                </div>
                <pre
                  className="px-5 py-4 text-[12.5px] text-green-300/90 overflow-x-auto leading-6"
                  style={{ fontFamily: fonts.mono }}
                >
                  {CODE_SNIPPET}
                </pre>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
                {t("datasets.api.suggestedJoins")}
              </h3>
              <div className="space-y-2">
                {suggestedJoins.map((r) => (
                  <div
                    key={r.name}
                    className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <GitBranch size={13} className="text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[13px] font-medium text-foreground">{r.name}</p>
                        <p className="text-[11px] text-muted-foreground">{r.join}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ProviderBadge name={r.provider} />
                      <ExternalLink size={12} className="text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Download size={13} />
              {t("datasets.api.downloadCsv")}
            </button>
          </div>
        )}

        <div className="pb-8" />
      </div>
    </div>
  );
}
