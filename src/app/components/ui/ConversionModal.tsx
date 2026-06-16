import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Globe2,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  Mail,
  Package,
  ShieldAlert,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { theme } from '../../../styles/theme';
import { downloadRiskReportPdf } from '../../../reports/downloadRiskReportPdf';
import { getSampleAnalysisResult } from '../../../analysis/sampleAnalysis';
import type { AnalysisResult } from '../../../analysis/types';

type ConversionIntent = 'save' | 'export' | 'upload';

type ReportSectionKey =
  | 'overview'
  | 'vendors'
  | 'gaps'
  | 'evidence'
  | 'concentration'
  | 'remediation'
  | 'audit';

export type ReportSections = Record<ReportSectionKey, boolean>;

const DEFAULT_REPORT_SECTIONS: ReportSections = {
  overview: true,
  vendors: true,
  gaps: true,
  evidence: true,
  concentration: true,
  remediation: true,
  audit: true,
};

const REPORT_SECTION_OPTIONS: Array<{
  id: ReportSectionKey;
  label: string;
  description: string;
  pages: number;
  icon: React.ElementType;
}> = [
  {
    id: 'overview',
    label: 'Executive Summary',
    description: 'Board narrative, key risks, and recommended focus.',
    pages: 2,
    icon: LayoutDashboard,
  },
  {
    id: 'vendors',
    label: 'Vendor Intelligence',
    description: 'Supplier inventory, criticality, residency, and source traces.',
    pages: 2,
    icon: Building2,
  },
  {
    id: 'gaps',
    label: 'Findings',
    description: 'Regulatory and technology findings with evidence excerpts.',
    pages: 3,
    icon: ShieldAlert,
  },
  {
    id: 'evidence',
    label: 'Evidence Coverage',
    description: 'Evidence inventory, missing items, and source traces.',
    pages: 2,
    icon: FileText,
  },
  {
    id: 'concentration',
    label: 'Dependencies',
    description: 'Cloud concentration, outage impact, and dependency share.',
    pages: 2,
    icon: TrendingUp,
  },
  {
    id: 'remediation',
    label: 'Remediation Plans',
    description: 'Management actions, owners, timelines, and success criteria.',
    pages: 3,
    icon: ListChecks,
  },
  {
    id: 'audit',
    label: 'Board Package',
    description: 'Generated audit outputs and recommended next actions.',
    pages: 2,
    icon: Package,
  },
];

interface ConversionModalProps {
  open: boolean;
  intent?: ConversionIntent;
  onClose: () => void;
}

const INTENT_COPY: Record<
  ConversionIntent,
  {
    icon: typeof Download;
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
  }
> = {
  save: {
    icon: FileText,
    title: 'Save this analysis',
    description:
      'Create a free account to keep this sample analysis, compare future runs, and upload your own vendor documents next.',
    primaryCta: 'Save Analysis',
    secondaryCta: 'Continue exploring',
  },
  export: {
    icon: Download,
    title: 'Create your board pack',
    description:
      'Select the sections you want to include. Deselected sections remain available in the dashboard, but will not appear in the exported PDF.',
    primaryCta: 'Download Board Pack',
    secondaryCta: 'Preview first',
  },
  upload: {
    icon: Upload,
    title: 'Analyze your own vendor package',
    description:
      'Upload your own contracts, vendor lists, questionnaires, SOC reports, certificates, and registers to generate a private analysis.',
    primaryCta: 'Start Private Analysis',
    secondaryCta: 'Keep using sample',
  },
};

export function ConversionModal({
  open,
  intent = 'save',
  onClose,
}: ConversionModalProps) {
  const app = useApp() as ReturnType<typeof useApp> & {
    analysisResult?: AnalysisResult | null;
  };

  const { activeScenario } = app;
  const analysisResult = app.analysisResult ?? getSampleAnalysisResult(activeScenario.id);

  const [downloading, setDownloading] = useState(false);
  const [reportSections, setReportSections] = useState<ReportSections>(DEFAULT_REPORT_SECTIONS);

  const selectedSections = useMemo(
    () => REPORT_SECTION_OPTIONS.filter((section) => reportSections[section.id]),
    [reportSections]
  );

  const estimatedPages = selectedSections.reduce((sum, section) => sum + section.pages, 0);

  if (!open) {
    return null;
  }

  const copy = INTENT_COPY[intent];
  const Icon = copy.icon;

  const toggleReportSection = (section: ReportSectionKey) => {
    setReportSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const selectAllReportSections = () => {
    setReportSections(DEFAULT_REPORT_SECTIONS);
  };

  const clearReportSections = () => {
    setReportSections({
      overview: false,
      vendors: false,
      gaps: false,
      evidence: false,
      concentration: false,
      remediation: false,
      audit: false,
    });
  };

  const handlePrimaryClick = async () => {
    if (intent !== 'export') {
      return;
    }

    if (selectedSections.length === 0) {
      return;
    }

    try {
      setDownloading(true);
      await downloadRiskReportPdf(analysisResult, reportSections);
      onClose();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.40)' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl shadow-2xl"
        style={{ backgroundColor: theme.neutral.surface }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="relative flex-shrink-0 border-b px-6 py-5"
          style={{
            backgroundColor: theme.neutral.background,
            borderColor: theme.neutral.border,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 transition-colors"
            style={{
              color: theme.neutral.textMuted,
              backgroundColor: 'transparent',
            }}
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>

          <div
            className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: theme.brand.primaryLight }}
          >
            <Icon className="h-5 w-5" style={{ color: theme.brand.primary }} />
          </div>

          <h3
            style={{
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: theme.neutral.text,
            }}
            className="mb-2"
          >
            {copy.title}
          </h3>

          <p
            style={{
              fontSize: '13px',
              lineHeight: 1.6,
              color: theme.neutral.textSecondary,
            }}
            className="max-w-2xl"
          >
            {copy.description}
          </p>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div
            className="mb-4 rounded-2xl border p-4"
            style={{
              backgroundColor: theme.neutral.background,
              borderColor: theme.neutral.border,
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: theme.neutral.text,
                  }}
                >
                  {analysisResult.scenario.name}
                </p>

                <p
                  style={{
                    fontSize: '11px',
                    color: theme.neutral.textSecondary,
                  }}
                >
                  {analysisResult.scenario.headlineFinding}
                </p>
              </div>

              <div
                className="rounded-xl px-3 py-2 text-right shadow-sm"
                style={{ backgroundColor: theme.neutral.surface }}
              >
                <p
                  style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    color: theme.brand.primary,
                  }}
                >
                  {analysisResult.scenario.readinessScore}
                </p>

                <p
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: theme.neutral.textSecondary,
                  }}
                >
                  score
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                {
                  label: 'Vendors',
                  value: analysisResult.scenario.vendors,
                },
                {
                  label: 'Critical',
                  value: analysisResult.scenario.criticalVendors,
                },
                {
                  label: 'Docs',
                  value: analysisResult.scenario.documents,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl p-2"
                  style={{ backgroundColor: theme.neutral.surface }}
                >
                  <p
                    style={{
                      fontSize: '16px',
                      fontWeight: 800,
                      color: theme.neutral.text,
                    }}
                  >
                    {value}
                  </p>

                  <p
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: theme.neutral.textSecondary,
                    }}
                  >
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {intent === 'export' && (
            <div
              className="mb-4 rounded-2xl border p-4"
              style={{
                backgroundColor: theme.neutral.surface,
                borderColor: theme.neutral.border,
              }}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Globe2 className="h-4 w-4" style={{ color: theme.brand.primary }} />
                    <p
                      style={{
                        fontSize: '13px',
                        fontWeight: 800,
                        color: theme.neutral.text,
                      }}
                    >
                      Select report sections
                    </p>
                  </div>

                  <p
                    style={{
                      fontSize: '11px',
                      color: theme.neutral.textSecondary,
                    }}
                    className="mt-1"
                  >
                    {selectedSections.length} selected · approximately {estimatedPages} pages
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllReportSections}
                    className="rounded-lg border px-2.5 py-1.5"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: theme.neutral.background,
                      borderColor: theme.neutral.border,
                      color: theme.neutral.textSecondary,
                    }}
                  >
                    Select all
                  </button>

                  <button
                    type="button"
                    onClick={clearReportSections}
                    className="rounded-lg border px-2.5 py-1.5"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: theme.neutral.background,
                      borderColor: theme.neutral.border,
                      color: theme.neutral.textSecondary,
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {REPORT_SECTION_OPTIONS.map((section) => {
                  const selected = reportSections[section.id];
                  const SectionIcon = section.icon;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => toggleReportSection(section.id)}
                      className="rounded-xl border p-3 text-left transition-all"
                      style={{
                        backgroundColor: selected
                          ? theme.brand.primaryLight
                          : theme.neutral.background,
                        borderColor: selected
                          ? theme.brand.primaryBorder
                          : theme.neutral.border,
                        opacity: selected ? 1 : 0.58,
                      }}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-lg"
                            style={{ backgroundColor: theme.neutral.surface }}
                          >
                            <SectionIcon
                              className="h-3.5 w-3.5"
                              style={{
                                color: selected
                                  ? theme.brand.primary
                                  : theme.neutral.textMuted,
                              }}
                            />
                          </div>

                          <div>
                            <p
                              style={{
                                fontSize: '12px',
                                fontWeight: 800,
                                color: theme.neutral.text,
                              }}
                            >
                              {section.label}
                            </p>

                            <p
                              style={{
                                fontSize: '10px',
                                color: theme.neutral.textMuted,
                              }}
                            >
                              ~{section.pages} pages
                            </p>
                          </div>
                        </div>

                        <span
                          className="rounded-full border px-2 py-0.5"
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            backgroundColor: selected
                              ? theme.neutral.surface
                              : theme.neutral.background,
                            borderColor: selected
                              ? theme.brand.primaryBorder
                              : theme.neutral.border,
                            color: selected
                              ? theme.brand.primary
                              : theme.neutral.textMuted,
                          }}
                        >
                          {selected ? 'Included' : 'Excluded'}
                        </span>
                      </div>

                      <p
                        style={{
                          fontSize: '11px',
                          lineHeight: 1.45,
                          color: theme.neutral.textSecondary,
                        }}
                      >
                        {section.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {intent !== 'export' && (
            <>
              <div className="mb-4 space-y-2">
                {[
                  'Keep the generated analysis and board-ready output.',
                  'Upload your own vendor package when ready.',
                  'No credit card required for the private beta.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 flex-shrink-0"
                      style={{ color: theme.status.success }}
                    />

                    <p
                      style={{
                        fontSize: '12px',
                        lineHeight: 1.5,
                        color: theme.neutral.textSecondary,
                      }}
                    >
                      {item}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mb-3">
                <label
                  htmlFor="conversion-email"
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: theme.neutral.textSecondary,
                  }}
                  className="mb-1.5 block"
                >
                  Work email
                </label>

                <div
                  className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
                  style={{
                    backgroundColor: theme.neutral.surface,
                    borderColor: theme.neutral.border,
                  }}
                >
                  <Mail
                    className="h-4 w-4 flex-shrink-0"
                    style={{ color: theme.neutral.textMuted }}
                  />

                  <input
                    id="conversion-email"
                    type="email"
                    placeholder="you@company.com"
                    className="w-full bg-transparent outline-none"
                    style={{
                      fontSize: '14px',
                      color: theme.neutral.text,
                    }}
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={handlePrimaryClick}
            disabled={downloading || (intent === 'export' && selectedSections.length === 0)}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              fontSize: '14px',
              fontWeight: 800,
              backgroundColor: theme.brand.primary,
              color: theme.sidebar.activeText,
              boxShadow: theme.shadow.brand,
            }}
          >
            {downloading ? 'Preparing PDF…' : copy.primaryCta}
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl px-4 py-2.5 transition-colors"
            style={{
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: 'transparent',
              color: theme.neutral.textSecondary,
            }}
          >
            {copy.secondaryCta}
          </button>

          <div
            className="mt-4 flex items-start gap-2 rounded-xl border p-3"
            style={{
              backgroundColor: theme.neutral.background,
              borderColor: theme.neutral.border,
            }}
          >
            <LockKeyhole
              className="mt-0.5 h-4 w-4 flex-shrink-0"
              style={{ color: theme.neutral.textSecondary }}
            />

            <p
              style={{
                fontSize: '11px',
                lineHeight: 1.5,
                color: theme.neutral.textSecondary,
              }}
            >
              Private beta access. Guara should be configured with encryption, automatic deletion,
              and a no-training-on-customer-data policy before accepting sensitive documents.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
