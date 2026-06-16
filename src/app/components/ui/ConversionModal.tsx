import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Download,
  FileText,
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

export type ReportSectionKey =
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
  gaps: true,
  remediation: true,
  vendors: false,
  evidence: false,
  concentration: false,
  audit: false,
};

const FULL_REPORT_SECTIONS: ReportSections = {
  overview: true,
  gaps: true,
  remediation: true,
  vendors: true,
  evidence: true,
  concentration: true,
  audit: true,
};

const EMPTY_REPORT_SECTIONS: ReportSections = {
  overview: false,
  gaps: false,
  remediation: false,
  vendors: false,
  evidence: false,
  concentration: false,
  audit: false,
};

const CORE_SECTIONS: Array<{
  id: ReportSectionKey;
  label: string;
  description: string;
  pages: number;
  icon: React.ElementType;
}> = [
  {
    id: 'overview',
    label: 'Executive Summary',
    description: 'Board narrative and recommended focus.',
    pages: 2,
    icon: LayoutDashboard,
  },
  {
    id: 'gaps',
    label: 'Key Findings',
    description: 'Material regulatory and technology findings.',
    pages: 3,
    icon: ShieldAlert,
  },
  {
    id: 'remediation',
    label: 'Management Actions',
    description: 'Owners, timelines, actions, and success criteria.',
    pages: 3,
    icon: ListChecks,
  },
];

const APPENDIX_SECTIONS: Array<{
  id: ReportSectionKey;
  label: string;
  description: string;
  pages: number;
  icon: React.ElementType;
}> = [
  {
    id: 'vendors',
    label: 'Vendor Intelligence',
    description: 'Supplier inventory and criticality.',
    pages: 2,
    icon: Building2,
  },
  {
    id: 'evidence',
    label: 'Evidence Register',
    description: 'Evidence coverage and source traces.',
    pages: 2,
    icon: FileText,
  },
  {
    id: 'concentration',
    label: 'Dependencies',
    description: 'Concentration and outage impact.',
    pages: 2,
    icon: TrendingUp,
  },
  {
    id: 'audit',
    label: 'Audit Package',
    description: 'Generated audit outputs.',
    pages: 2,
    icon: Package,
  },
];

const ALL_SECTION_OPTIONS = [...CORE_SECTIONS, ...APPENDIX_SECTIONS];

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
  }
> = {
  save: {
    icon: FileText,
    title: 'Save this analysis',
    description:
      'Create a free account to keep this analysis, compare future runs, and upload your own vendor documents next.',
    primaryCta: 'Save Analysis',
  },
  export: {
    icon: Download,
    title: 'Create your board pack',
    description:
      'Choose a concise board pack or add appendices for a fuller audit-ready report.',
    primaryCta: 'Download Board Pack',
  },
  upload: {
    icon: Upload,
    title: 'Analyze your own vendor package',
    description:
      'Upload contracts, vendor lists, questionnaires, SOC reports, certificates, and registers to generate a private analysis.',
    primaryCta: 'Start Private Analysis',
  },
};

function SectionOption({
  section,
  selected,
  onToggle,
}: {
  section: (typeof ALL_SECTION_OPTIONS)[number];
  selected: boolean;
  onToggle: () => void;
}) {
  const Icon = section.icon;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-xl border px-3 py-2 text-left transition-all"
      style={{
        backgroundColor: selected ? theme.brand.primaryLight : theme.neutral.background,
        borderColor: selected ? theme.brand.primaryBorder : theme.neutral.border,
        opacity: selected ? 1 : 0.62,
      }}
    >
      <div className="flex items-start gap-2">
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: theme.neutral.surface }}
        >
          <Icon
            className="h-3.5 w-3.5"
            style={{
              color: selected ? theme.brand.primary : theme.neutral.textMuted,
            }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: theme.neutral.text,
              }}
            >
              {section.label}
            </p>

            <span
              className="rounded-full border px-2 py-0.5"
              style={{
                fontSize: '9px',
                fontWeight: 800,
                backgroundColor: selected ? theme.neutral.surface : theme.neutral.background,
                borderColor: selected ? theme.brand.primaryBorder : theme.neutral.border,
                color: selected ? theme.brand.primary : theme.neutral.textMuted,
              }}
            >
              {selected ? 'On' : 'Off'}
            </span>
          </div>

          <p
            style={{
              fontSize: '10px',
              lineHeight: 1.35,
              color: theme.neutral.textSecondary,
            }}
            className="mt-0.5"
          >
            {section.description} · ~{section.pages} pages
          </p>
        </div>
      </div>
    </button>
  );
}

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
    () => ALL_SECTION_OPTIONS.filter((section) => reportSections[section.id]),
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
    } catch (error) {
      console.error('Failed to download risk report PDF', error);
      window.alert('Could not generate the PDF. Please check the console for details.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.40)' }}
      onClick={onClose}
    >
      <div
        className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-3xl shadow-2xl lg:grid-cols-[0.9fr_1.35fr]"
        style={{
          backgroundColor: theme.neutral.surface,
          maxHeight: 'calc(100vh - 24px)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="relative border-b p-5 lg:border-b-0 lg:border-r"
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
            className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: theme.brand.primaryLight }}
          >
            <Icon className="h-5 w-5" style={{ color: theme.brand.primary }} />
          </div>

          <h3
            style={{
              fontSize: '21px',
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
              fontSize: '12px',
              lineHeight: 1.5,
              color: theme.neutral.textSecondary,
            }}
          >
            {copy.description}
          </p>

          <div
            className="mt-4 rounded-2xl border p-3"
            style={{
              backgroundColor: theme.neutral.surface,
              borderColor: theme.neutral.border,
            }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: theme.neutral.text,
                  }}
                  className="truncate"
                >
                  {analysisResult.scenario.name}
                </p>

                <p
                  style={{
                    fontSize: '11px',
                    color: theme.neutral.textSecondary,
                  }}
                  className="mt-0.5 line-clamp-2"
                >
                  {analysisResult.scenario.headlineFinding}
                </p>
              </div>

              <div
                className="rounded-xl px-3 py-2 text-right"
                style={{ backgroundColor: theme.brand.primaryLight }}
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
                  style={{ backgroundColor: theme.neutral.background }}
                >
                  <p
                    style={{
                      fontSize: '15px',
                      fontWeight: 800,
                      color: theme.neutral.text,
                    }}
                  >
                    {value}
                  </p>

                  <p
                    style={{
                      fontSize: '9px',
                      fontWeight: 700,
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
              className="mt-4 rounded-2xl border p-3"
              style={{
                backgroundColor: theme.sidebar.background,
                borderColor: theme.sidebar.border,
              }}
            >
              <p
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: theme.sidebar.activeText,
                }}
              >
                Selected report
              </p>

              <p
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: theme.brand.primary,
                }}
                className="mt-1"
              >
                {estimatedPages} pages
              </p>

              <p
                style={{
                  fontSize: '11px',
                  lineHeight: 1.45,
                  color: theme.sidebar.text,
                }}
              >
                {selectedSections.length} sections selected. Core board pack sections are selected by default.
              </p>
            </div>
          )}

          {intent !== 'export' && (
            <div className="mt-4">
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
          )}
        </div>

        <div className="flex min-h-0 flex-col p-5">
          {intent === 'export' ? (
            <>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 800,
                      color: theme.neutral.text,
                    }}
                  >
                    Report contents
                  </p>

                  <p
                    style={{
                      fontSize: '11px',
                      color: theme.neutral.textSecondary,
                    }}
                    className="mt-0.5"
                  >
                    Board pack sections first. Appendices are optional.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReportSections(DEFAULT_REPORT_SECTIONS)}
                    className="rounded-lg border px-2.5 py-1.5"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: theme.brand.primaryLight,
                      borderColor: theme.brand.primaryBorder,
                      color: theme.brand.primary,
                    }}
                  >
                    Board pack
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportSections(FULL_REPORT_SECTIONS)}
                    className="rounded-lg border px-2.5 py-1.5"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: theme.neutral.background,
                      borderColor: theme.neutral.border,
                      color: theme.neutral.textSecondary,
                    }}
                  >
                    Full pack
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportSections(EMPTY_REPORT_SECTIONS)}
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

              <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
                <div
                  className="rounded-2xl border p-3"
                  style={{
                    backgroundColor: theme.neutral.background,
                    borderColor: theme.neutral.border,
                  }}
                >
                  <p
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: theme.neutral.text,
                    }}
                    className="mb-2"
                  >
                    Core Board Pack
                  </p>

                  <div className="space-y-2">
                    {CORE_SECTIONS.map((section) => (
                      <SectionOption
                        key={section.id}
                        section={section}
                        selected={reportSections[section.id]}
                        onToggle={() => toggleReportSection(section.id)}
                      />
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-2xl border p-3"
                  style={{
                    backgroundColor: theme.neutral.background,
                    borderColor: theme.neutral.border,
                  }}
                >
                  <p
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: theme.neutral.text,
                    }}
                    className="mb-2"
                  >
                    Optional Appendices
                  </p>

                  <div className="space-y-2">
                    {APPENDIX_SECTIONS.map((section) => (
                      <SectionOption
                        key={section.id}
                        section={section}
                        selected={reportSections[section.id]}
                        onToggle={() => toggleReportSection(section.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col justify-center">
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
            </div>
          )}

          <div className="mt-4 flex-shrink-0">
            <button
              type="button"
              onClick={handlePrimaryClick}
              disabled={downloading || (intent === 'export' && selectedSections.length === 0)}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
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

            <div
              className="mt-3 flex items-start gap-2 rounded-xl border p-3"
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
                  fontSize: '10px',
                  lineHeight: 1.45,
                  color: theme.neutral.textSecondary,
                }}
              >
                Private beta access. Configure encryption, automatic deletion, and a no-training-on-customer-data policy before accepting sensitive documents.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
