import {
  AlertTriangle,
  Bot,
  CalendarDays,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FileSearch,
  FileWarning,
  Globe2,
  ListChecks,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { Badge } from '../Badge';
import { theme } from '../../../styles/theme';
import { useAnalysisResult } from '../../../hooks/useAnalysisResult';
import { getGapSummary, severityColor } from '../../../analysis/selectors';
import type { Finding, FindingCategory, RemediationPlan } from '../../../analysis/types';

function CategoryIcon({ category }: { category: FindingCategory }) {
  const iconStyle = { color: theme.brand.primary };

  if (category === 'Data Residency') return <Database className="h-4 w-4" style={iconStyle} />;
  if (category === 'AI Act') return <Bot className="h-4 w-4" style={iconStyle} />;
  if (category === 'Digital Sovereignty') return <Globe2 className="h-4 w-4" style={iconStyle} />;
  if (category === 'Operational Resilience') return <Cloud className="h-4 w-4" style={iconStyle} />;

  return <FileWarning className="h-4 w-4" style={iconStyle} />;
}

function categoryStyle(category: FindingCategory): React.CSSProperties {
  if (category === 'DORA') {
    return {
      backgroundColor: theme.brand.primaryLight,
      borderColor: theme.brand.primaryBorder,
      color: theme.brand.primary,
    };
  }

  if (category === 'Data Residency') {
    return {
      backgroundColor: theme.status.infoLight,
      borderColor: theme.status.info,
      color: theme.status.info,
    };
  }

  if (category === 'Digital Sovereignty') {
    return {
      backgroundColor: theme.status.warningLight,
      borderColor: theme.status.warning,
      color: theme.status.warning,
    };
  }

  return {
    backgroundColor: theme.neutral.background,
    borderColor: theme.neutral.border,
    color: theme.neutral.textSecondary,
  };
}

function FindingTraceBlock({ finding }: { finding: Finding }) {
  const trace = finding.trace ?? [];

  if (trace.length === 0) {
    return null;
  }

  return (
    <div
      className="mt-3 rounded-xl border p-3"
      style={{
        backgroundColor: theme.neutral.background,
        borderColor: theme.neutral.border,
      }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <FileSearch className="h-3.5 w-3.5" style={{ color: theme.brand.primary }} />

        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            color: theme.neutral.text,
          }}
        >
          Why was this detected?
        </span>
      </div>

      <div className="space-y-2">
        {trace.slice(0, 3).map((item, index) => (
          <div
            key={`${item.document}-${item.chunkId ?? index}`}
            className="rounded-lg border p-2"
            style={{
              backgroundColor: theme.neutral.surface,
              borderColor: theme.neutral.border,
            }}
          >
            <p
              style={{
                fontSize: '10px',
                fontWeight: 800,
                color: theme.brand.primary,
              }}
            >
              {item.document}
              {item.page ? ` · page ${item.page}` : ''} ·{' '}
              {Math.round(item.confidence * 100)}% confidence
            </p>

            <p
              className="mt-1"
              style={{
                fontSize: '11px',
                lineHeight: 1.5,
                color: theme.neutral.textSecondary,
              }}
            >
              “{item.excerpt}”
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RemediationPlanBlock({ plan }: { plan?: RemediationPlan }) {
  if (!plan) {
    return null;
  }

  return (
    <div
      className="mt-3 rounded-xl border p-3"
      style={{
        backgroundColor: theme.brand.primaryLight,
        borderColor: theme.brand.primaryBorder,
      }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <ListChecks className="h-3.5 w-3.5" style={{ color: theme.brand.primary }} />

        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            color: theme.neutral.text,
          }}
        >
          Remediation plan
        </span>

        <span
          className="rounded-full border px-2 py-0.5"
          style={{
            fontSize: '10px',
            fontWeight: 800,
            backgroundColor: theme.neutral.surface,
            borderColor: theme.brand.primaryBorder,
            color: theme.brand.primary,
          }}
        >
          {plan.status}
        </span>
      </div>

      <p
        style={{
          fontSize: '12px',
          lineHeight: 1.55,
          color: theme.neutral.textSecondary,
        }}
      >
        {plan.objective}
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="flex items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5" style={{ color: theme.brand.primary }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: theme.neutral.text }}>
            Owner: {plan.owner}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" style={{ color: theme.brand.primary }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: theme.neutral.text }}>
            Timeline: {plan.timeline}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" style={{ color: severityColor(plan.priority, theme) }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: theme.neutral.text }}>
            Priority: {plan.priority}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <p style={{ fontSize: '11px', fontWeight: 800, color: theme.neutral.text }}>
          Actions
        </p>

        <div className="mt-1.5 space-y-1.5">
          {plan.actions.slice(0, 4).map((action, index) => (
            <div key={`${plan.id}-action-${index}`} className="flex items-start gap-1.5">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color: theme.brand.primary }} />
              <span style={{ fontSize: '11px', lineHeight: 1.45, color: theme.neutral.textSecondary }}>
                {action}
              </span>
            </div>
          ))}
        </div>
      </div>

      {plan.successCriteria.length > 0 && (
        <div className="mt-3">
          <p style={{ fontSize: '11px', fontWeight: 800, color: theme.neutral.text }}>
            Success criteria
          </p>

          <div className="mt-1.5 space-y-1.5">
            {plan.successCriteria.slice(0, 3).map((criterion, index) => (
              <div key={`${plan.id}-success-${index}`} className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color: theme.status.success }} />
                <span style={{ fontSize: '11px', lineHeight: 1.45, color: theme.neutral.textSecondary }}>
                  {criterion}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function findRemediationPlan(
  plans: RemediationPlan[],
  finding: Finding
): RemediationPlan | undefined {
  return plans.find(
    (plan) =>
      plan.findingTitle === finding.title &&
      plan.vendor === finding.vendor &&
      plan.category === finding.category
  );
}

export function GapsTab() {
  const analysisResult = useAnalysisResult();
  const { scenario } = analysisResult;
  const summary = getGapSummary(analysisResult);
  const remediationPlans = analysisResult.remediationPlans ?? [];

  const summaryCards = [
    {
      label: 'Total findings',
      value: summary.total,
      sub: 'Across regulatory and technology risk',
    },
    {
      label: 'High severity',
      value: summary.highCount,
      sub: 'Requires priority remediation',
      warning: true,
    },
    {
      label: 'Remediation plans',
      value: remediationPlans.length,
      sub: 'Generated action plans',
    },
    {
      label: 'Scenario score',
      value: `${scenario.readinessScore}/100`,
      sub: 'Audit readiness baseline',
    },
  ];

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: theme.neutral.text }}>
            Gap & Risk Analysis
          </h2>
          <p style={{ fontSize: '12px', color: theme.neutral.textSecondary }} className="mt-0.5">
            {summary.total} findings · {summary.highCount} high severity · {remediationPlans.length} remediation plans · {scenario.name}
          </p>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 transition-colors"
          style={{
            fontSize: '12px',
            backgroundColor: theme.neutral.surface,
            borderColor: theme.neutral.border,
            color: theme.neutral.textSecondary,
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border p-3 shadow-sm"
            style={{
              backgroundColor: card.warning ? theme.status.errorLight : theme.neutral.surface,
              borderColor: card.warning ? theme.status.error : theme.neutral.border,
            }}
          >
            <p
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: card.warning ? theme.status.error : theme.neutral.text,
              }}
            >
              {card.value}
            </p>
            <p style={{ fontSize: '10px', fontWeight: 700, color: theme.neutral.text }} className="mt-0.5">
              {card.label}
            </p>
            <p style={{ fontSize: '10px', color: theme.neutral.textMuted }} className="mt-0.5">
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      <div
        className="mb-4 rounded-2xl border p-4"
        style={{
          backgroundColor: theme.status.warningLight,
          borderColor: theme.status.warning,
        }}
      >
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: theme.status.warning }} />
          <div>
            <p style={{ fontSize: '13px', fontWeight: 800, color: theme.neutral.text }}>
              Priority interpretation
            </p>
            <p style={{ fontSize: '12px', lineHeight: 1.55, color: theme.neutral.textSecondary }}>
              {scenario.headlineFinding} {scenario.mainRisk}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {summary.categories.map((category) => (
          <span
            key={category}
            className="rounded-full border px-3 py-1"
            style={{
              fontSize: '11px',
              fontWeight: 700,
              ...categoryStyle(category),
            }}
          >
            {category}
          </span>
        ))}
      </div>

      <div className="space-y-2.5">
        {summary.findings.map((finding) => {
          const remediationPlan = findRemediationPlan(remediationPlans, finding);

          return (
            <div
              key={`${finding.title}-${finding.vendor}-${finding.category}`}
              className="rounded-xl border p-4 shadow-sm transition-colors"
              style={{
                backgroundColor: theme.neutral.surface,
                borderColor: theme.neutral.border,
              }}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <div
                    className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: theme.brand.primaryLight }}
                  >
                    <CategoryIcon category={finding.category} />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p style={{ fontSize: '13px', fontWeight: 700, color: theme.neutral.text }}>
                        {finding.title}
                      </p>

                      <span
                        className="rounded-full border px-2 py-0.5"
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          ...categoryStyle(finding.category),
                        }}
                      >
                        {finding.category}
                      </span>
                    </div>

                    <p style={{ fontSize: '11px', fontWeight: 600, color: theme.brand.primary }} className="mt-1">
                      Vendor: {finding.vendor}
                    </p>
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <span
                    style={{
                      fontSize: '10px',
                      backgroundColor: theme.neutral.background,
                      color: theme.neutral.textMuted,
                    }}
                    className="rounded px-1.5 py-0.5 font-mono"
                  >
                    {finding.article}
                  </span>

                  <Badge level={finding.severity} />
                </div>
              </div>

              <div className="ml-9">
                <div className="mb-2 flex items-center gap-1.5">
                  <AlertTriangle
                    className="h-3.5 w-3.5 flex-shrink-0"
                    style={{ color: severityColor(finding.severity, theme) }}
                  />

                  <span style={{ fontSize: '11px', fontWeight: 700, color: theme.neutral.textSecondary }}>
                    Recommended action
                  </span>
                </div>

                <p style={{ fontSize: '12px', lineHeight: 1.6, color: theme.neutral.textSecondary }}>
                  {finding.rec}
                </p>

                <RemediationPlanBlock plan={remediationPlan} />

                <FindingTraceBlock finding={finding} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
