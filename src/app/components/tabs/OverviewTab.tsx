import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Cloud,
  Database,
  FileText,
  Globe2,
  KeyRound,
  Package,
  ShieldAlert,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Badge } from '../Badge';
import { theme } from '../../../styles/theme';
import { useAnalysisResult } from '../../../hooks/useAnalysisResult';
import { getHighSeverityGaps, getSovereigntyScore } from '../../../analysis/selectors';
import { useApp, type ReportSectionKey } from '../../contexts/AppContext';

function DependencyIcon({ type }: { type: 'cloud' | 'payments' | 'identity' | 'data' }) {
  const iconStyle = { color: theme.brand.primary };

  if (type === 'cloud') return <Cloud className="h-3.5 w-3.5" style={iconStyle} />;
  if (type === 'identity') return <KeyRound className="h-3.5 w-3.5" style={iconStyle} />;

  return <Database className="h-3.5 w-3.5" style={iconStyle} />;
}

const REPORT_SECTIONS: Array<{
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
    icon: Zap,
  },
  {
    id: 'vendors',
    label: 'Vendor Intelligence',
    description: 'Supplier inventory, criticality, residency, and traceability.',
    pages: 2,
    icon: Building2,
  },
  {
    id: 'gaps',
    label: 'Findings',
    description: 'Regulatory and technology findings with evidence excerpts.',
    pages: 3,
    icon: AlertTriangle,
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
    icon: CheckCircle2,
  },
  {
    id: 'audit',
    label: 'Board Package',
    description: 'Generated audit outputs and recommended next actions.',
    pages: 2,
    icon: Package,
  },
];

export function OverviewTab() {
  const analysisResult = useAnalysisResult();
  const { reportSections, toggleReportSection, resetReportSections } = useApp();
  const { scenario } = analysisResult;

  const sovereigntyScore = getSovereigntyScore(analysisResult);
  const highGaps = getHighSeverityGaps(analysisResult);
  const remediationPlans = analysisResult.remediationPlans ?? [];

  const highPriorityPlans = remediationPlans.filter((plan) => plan.priority === 'High').length;
  const openPlans = remediationPlans.filter((plan) => plan.status === 'Open').length;

  const selectedSections = REPORT_SECTIONS.filter((section) => reportSections[section.id]);
  const estimatedPages = selectedSections.reduce((sum, section) => sum + section.pages, 0);

  const kpis = [
    {
      label: 'Readiness',
      value: `${scenario.readinessScore}/100`,
      sub: 'Audit-ready output',
      highlight: true,
    },
    {
      label: 'Sovereignty',
      value: `${sovereigntyScore}/100`,
      sub: scenario.regionExposure,
    },
    {
      label: 'Vendors',
      value: String(scenario.vendors),
      sub: `${scenario.criticalVendors} critical`,
    },
    {
      label: 'Documents',
      value: String(scenario.documents),
      sub: analysisResult.source === 'sample' ? 'Sample package' : 'Uploaded package',
    },
    {
      label: 'Report Sections',
      value: String(selectedSections.length),
      sub: `${estimatedPages} estimated pages`,
    },
    {
      label: 'Open Actions',
      value: String(openPlans),
      sub: 'Management follow-up',
      warning: openPlans > 0,
    },
  ];

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {kpis.map(({ label, value, sub, highlight, warning }) => (
          <div
            key={label}
            className="rounded-xl border p-3 shadow-sm"
            style={{
              backgroundColor: warning
                ? theme.status.warningLight
                : highlight
                  ? theme.brand.primaryLight
                  : theme.neutral.surface,
              borderColor: warning
                ? theme.status.warning
                : highlight
                  ? theme.brand.primaryBorder
                  : theme.neutral.border,
            }}
          >
            <p
              style={{
                fontSize: 'clamp(14px, 2vw, 20px)',
                fontWeight: 800,
                color: warning
                  ? theme.status.warning
                  : highlight
                    ? theme.brand.primary
                    : theme.neutral.text,
              }}
            >
              {value}
            </p>

            <p
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: theme.neutral.text,
              }}
              className="mt-0.5"
            >
              {label}
            </p>

            <p
              style={{
                fontSize: '10px',
                color: theme.neutral.textMuted,
              }}
              className="mt-0.5 truncate"
            >
              {sub}
            </p>
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl border p-4 shadow-sm"
        style={{
          backgroundColor: theme.neutral.surface,
          borderColor: theme.neutral.border,
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p style={{ fontSize: '14px', fontWeight: 800, color: theme.neutral.text }}>
              Build Report
            </p>

            <p style={{ fontSize: '11px', color: theme.neutral.textSecondary }}>
              Select the sections that should appear in the exported PDF. Click a section to include or exclude it.
            </p>
          </div>

          <button
            type="button"
            onClick={resetReportSections}
            className="rounded-lg border px-3 py-1.5"
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
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_SECTIONS.map((section) => {
            const selected = reportSections[section.id];
            const Icon = section.icon;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => toggleReportSection(section.id)}
                className="rounded-xl border p-3 text-left transition-all"
                style={{
                  backgroundColor: selected ? theme.brand.primaryLight : theme.neutral.background,
                  borderColor: selected ? theme.brand.primaryBorder : theme.neutral.border,
                  opacity: selected ? 1 : 0.58,
                }}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: selected ? theme.neutral.surface : theme.neutral.surface,
                      }}
                    >
                      <Icon
                        className="h-3.5 w-3.5"
                        style={{
                          color: selected ? theme.brand.primary : theme.neutral.textMuted,
                        }}
                      />
                    </div>

                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 800, color: theme.neutral.text }}>
                        {section.label}
                      </p>

                      <p style={{ fontSize: '10px', color: theme.neutral.textMuted }}>
                        ~{section.pages} pages
                      </p>
                    </div>
                  </div>

                  <span
                    className="rounded-full border px-2 py-0.5"
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      backgroundColor: selected ? theme.neutral.surface : theme.neutral.background,
                      borderColor: selected ? theme.brand.primaryBorder : theme.neutral.border,
                      color: selected ? theme.brand.primary : theme.neutral.textMuted,
                    }}
                  >
                    {selected ? 'Included' : 'Excluded'}
                  </span>
                </div>

                <p style={{ fontSize: '11px', lineHeight: 1.45, color: theme.neutral.textSecondary }}>
                  {section.description}
                </p>
              </button>
            );
          })}
        </div>

        <div
          className="mt-3 rounded-xl border p-3"
          style={{
            backgroundColor: theme.neutral.background,
            borderColor: theme.neutral.border,
          }}
        >
          <p style={{ fontSize: '11px', fontWeight: 800, color: theme.neutral.text }}>
            Selected report: {selectedSections.length} sections · approximately {estimatedPages} pages
          </p>
          <p style={{ fontSize: '11px', color: theme.neutral.textSecondary }} className="mt-0.5">
            Deselected sections remain visible in the dashboard, but they will not be included in the exported PDF.
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: theme.sidebar.background,
          borderColor: theme.sidebar.border,
          boxShadow: theme.shadow.card,
        }}
      >
        <div className="mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4" style={{ color: theme.brand.primary }} />

          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: theme.sidebar.activeText,
            }}
          >
            AI Executive Summary
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {[
            analysisResult.executiveSummary?.narrative ??
              `Analysed ${scenario.documents} documents for a ${scenario.industry.toLowerCase()} scenario covering ${scenario.vendors} vendors.`,
            `${scenario.criticalVendors} critical vendors identified across technology, data, infrastructure, and operational services.`,
            `${remediationPlans.length} remediation plans generated, including ${highPriorityPlans} high-priority actions.`,
            scenario.headlineFinding,
            scenario.mainRisk,
            `Digital sovereignty exposure: ${scenario.regionExposure}.`,
          ].map((line) => (
            <div key={line} className="flex items-start gap-1.5">
              <span className="mt-0.5 flex-shrink-0" style={{ color: theme.brand.primary }}>
                ›
              </span>

              <span
                style={{
                  fontSize: '12px',
                  lineHeight: 1.6,
                  color: theme.sidebar.text,
                }}
              >
                {line}
              </span>
            </div>
          ))}
        </div>
      </div>

      {remediationPlans.length > 0 && (
        <div
          className="rounded-2xl border p-4 shadow-sm"
          style={{
            backgroundColor: theme.neutral.surface,
            borderColor: theme.neutral.border,
          }}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: theme.brand.primaryLight }}
              >
                <CheckCircle2 className="h-4.5 w-4.5" style={{ color: theme.brand.primary }} />
              </div>

              <div>
                <p
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: theme.neutral.text,
                  }}
                >
                  Remediation Priorities
                </p>

                <p
                  style={{
                    fontSize: '11px',
                    color: theme.neutral.textSecondary,
                  }}
                >
                  Highest priority management actions generated from findings
                </p>
              </div>
            </div>

            <Badge level={highPriorityPlans > 0 ? 'High' : 'Low'} />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {remediationPlans.slice(0, 4).map((plan) => (
              <div
                key={plan.id}
                className="rounded-xl border p-3"
                style={{
                  backgroundColor: theme.neutral.background,
                  borderColor: theme.neutral.border,
                }}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color: theme.neutral.text,
                    }}
                  >
                    {plan.findingTitle}
                  </p>

                  <Badge level={plan.priority} />
                </div>

                <p
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: theme.brand.primary,
                  }}
                >
                  {plan.owner} · {plan.timeline} · {plan.status}
                </p>

                <p
                  style={{
                    fontSize: '11px',
                    lineHeight: 1.45,
                    color: theme.neutral.textSecondary,
                  }}
                  className="mt-1"
                >
                  {plan.actions[0] ?? plan.objective}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div
          className="rounded-2xl border p-4 shadow-sm"
          style={{
            backgroundColor: theme.neutral.surface,
            borderColor: theme.neutral.border,
          }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: theme.brand.primaryLight }}
              >
                <Globe2 className="h-4.5 w-4.5" style={{ color: theme.brand.primary }} />
              </div>

              <div>
                <p
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: theme.neutral.text,
                  }}
                >
                  Digital Sovereignty Score
                </p>

                <p
                  style={{
                    fontSize: '11px',
                    color: theme.neutral.textSecondary,
                  }}
                >
                  Cloud, data, AI, and concentration exposure
                </p>
              </div>
            </div>

            <div className="text-right">
              <p
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                  color: theme.neutral.text,
                }}
              >
                {sovereigntyScore}
              </p>

              <p
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: theme.neutral.textSecondary,
                }}
              >
                /100
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {[
              ['Cloud sovereignty', analysisResult.sovereigntyScores.cloud],
              ['Data residency', analysisResult.sovereigntyScores.data],
              ['AI sovereignty', analysisResult.sovereigntyScores.ai],
              ['Vendor concentration', analysisResult.sovereigntyScores.concentration],
              ['Regulatory readiness', analysisResult.sovereigntyScores.regulatory],
            ].map(([label, value]) => (
              <div key={label as string}>
                <div className="mb-1 flex justify-between">
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: theme.neutral.textSecondary,
                    }}
                  >
                    {label}
                  </span>

                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      color: theme.neutral.text,
                    }}
                  >
                    {value}
                  </span>
                </div>

                <div
                  className="h-1.5 overflow-hidden rounded-full"
                  style={{ backgroundColor: theme.neutral.border }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${value}%`,
                      backgroundColor: theme.brand.primary,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-4 flex items-start gap-2 rounded-xl border p-3"
            style={{
              backgroundColor: theme.status.warningLight,
              borderColor: theme.status.warning,
            }}
          >
            <ShieldAlert
              className="mt-0.5 h-4 w-4 flex-shrink-0"
              style={{ color: theme.status.warning }}
            />

            <p
              style={{
                fontSize: '11px',
                lineHeight: 1.5,
                color: theme.neutral.text,
              }}
            >
              Main concern: {scenario.regionExposure}. {scenario.mainRisk}
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl border p-4 shadow-sm"
          style={{
            backgroundColor: theme.neutral.surface,
            borderColor: theme.neutral.border,
          }}
        >
          <div className="mb-4 flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: theme.brand.primaryLight }}
            >
              <Building2 className="h-4.5 w-4.5" style={{ color: theme.brand.primary }} />
            </div>

            <div>
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: theme.neutral.text,
                }}
              >
                Technology Dependency Map
              </p>

              <p
                style={{
                  fontSize: '11px',
                  color: theme.neutral.textSecondary,
                }}
              >
                Providers supporting critical business operations
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {analysisResult.dependencies.map((dependency) => (
              <div
                key={`${dependency.vendor}-${dependency.service}`}
                className="rounded-xl border p-3"
                style={{
                  backgroundColor: theme.neutral.background,
                  borderColor: theme.neutral.border,
                }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ backgroundColor: theme.neutral.surface }}
                  >
                    <DependencyIcon type={dependency.icon} />
                  </div>

                  <div className="min-w-0">
                    <p
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        color: theme.neutral.text,
                      }}
                      className="truncate"
                    >
                      {dependency.vendor}
                    </p>

                    <p
                      style={{
                        fontSize: '10px',
                        color: theme.neutral.textMuted,
                      }}
                      className="truncate"
                    >
                      {dependency.service}
                    </p>
                  </div>
                </div>

                <p
                  style={{
                    fontSize: '11px',
                    lineHeight: 1.45,
                    color: theme.neutral.textSecondary,
                  }}
                >
                  Impacts: {dependency.impact}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div
          className="overflow-hidden rounded-xl border shadow-sm"
          style={{
            backgroundColor: theme.neutral.surface,
            borderColor: theme.neutral.border,
          }}
        >
          <div className="border-b px-4 py-3" style={{ borderColor: theme.neutral.border }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: theme.neutral.text,
              }}
            >
              Critical Vendors
            </span>
          </div>

          <div>
            {analysisResult.vendors
              .filter((vendor) => vendor.criticality === 'Critical')
              .map((vendor, index) => (
                <div
                  key={vendor.name}
                  className="flex items-center gap-2.5 px-4 py-2.5"
                  style={{
                    borderTop:
                      index === 0 ? undefined : `1px solid ${theme.neutral.background}`,
                  }}
                >
                  <div
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: theme.brand.primaryLight }}
                  >
                    <Building2 className="h-3.5 w-3.5" style={{ color: theme.brand.primary }} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: theme.neutral.text,
                      }}
                    >
                      {vendor.name}
                    </p>

                    <p
                      style={{
                        fontSize: '10px',
                        color: theme.neutral.textMuted,
                      }}
                    >
                      {vendor.service} · {vendor.country}
                    </p>
                  </div>

                  <Badge level={vendor.risk} />
                </div>
              ))}
          </div>
        </div>

        <div
          className="overflow-hidden rounded-xl border shadow-sm"
          style={{
            backgroundColor: theme.neutral.surface,
            borderColor: theme.neutral.border,
          }}
        >
          <div className="border-b px-4 py-3" style={{ borderColor: theme.neutral.border }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: theme.neutral.text,
              }}
            >
              Board-Level Priority Risks
            </span>
          </div>

          <div>
            {analysisResult.boardRisks.map((risk, index) => (
              <div
                key={risk}
                className="flex items-start gap-2.5 px-4 py-2.5"
                style={{
                  borderTop:
                    index === 0 ? undefined : `1px solid ${theme.neutral.background}`,
                }}
              >
                <div
                  className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: theme.brand.primaryLight }}
                >
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      color: theme.brand.primary,
                    }}
                  >
                    {index + 1}
                  </span>
                </div>

                <p
                  style={{
                    fontSize: '12px',
                    lineHeight: 1.5,
                    color: theme.neutral.textSecondary,
                  }}
                >
                  {risk}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-xl border shadow-sm"
        style={{
          backgroundColor: theme.neutral.surface,
          borderColor: theme.neutral.border,
        }}
      >
        <div className="border-b px-4 py-3" style={{ borderColor: theme.neutral.border }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: theme.neutral.text,
            }}
          >
            Highest Severity Gaps
          </span>
        </div>

        <div>
          {highGaps.slice(0, 4).map((gap, index) => (
            <div
              key={`${gap.title}-${gap.vendor}`}
              className="flex items-start gap-2.5 px-4 py-2.5"
              style={{
                borderTop:
                  index === 0 ? undefined : `1px solid ${theme.neutral.background}`,
              }}
            >
              <AlertTriangle
                className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
                style={{ color: theme.status.error }}
              />

              <div className="min-w-0 flex-1">
                <p
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: theme.neutral.text,
                  }}
                >
                  {gap.title}
                </p>

                <p
                  style={{
                    fontSize: '10px',
                    color: theme.neutral.textMuted,
                  }}
                >
                  {gap.vendor} · {gap.article}
                </p>
              </div>

              <Badge level={gap.severity} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
