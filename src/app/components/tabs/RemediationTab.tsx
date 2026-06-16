import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  ListChecks,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { Badge } from '../Badge';
import { theme } from '../../../styles/theme';
import { useAnalysisResult } from '../../../hooks/useAnalysisResult';
import { severityColor } from '../../../analysis/selectors';
import type { RemediationPlan } from '../../../analysis/types';

type RemediationFilter = 'all' | 'high' | 'open' | 'in-progress' | 'completed';

function ownerStyle(owner: RemediationPlan['owner']): React.CSSProperties {
  if (owner === 'Procurement') {
    return {
      backgroundColor: theme.brand.primaryLight,
      borderColor: theme.brand.primaryBorder,
      color: theme.brand.primary,
    };
  }

  if (owner === 'Data Protection') {
    return {
      backgroundColor: theme.status.infoLight,
      borderColor: theme.status.info,
      color: theme.status.info,
    };
  }

  if (owner === 'IT' || owner === 'Security') {
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

function statusStyle(status: RemediationPlan['status']): React.CSSProperties {
  if (status === 'Completed') {
    return {
      backgroundColor: theme.status.successLight,
      borderColor: theme.status.success,
      color: theme.status.success,
    };
  }

  if (status === 'Blocked') {
    return {
      backgroundColor: theme.status.errorLight,
      borderColor: theme.status.error,
      color: theme.status.error,
    };
  }

  if (status === 'In Progress') {
    return {
      backgroundColor: theme.status.infoLight,
      borderColor: theme.status.info,
      color: theme.status.info,
    };
  }

  return {
    backgroundColor: theme.neutral.background,
    borderColor: theme.neutral.border,
    color: theme.neutral.textSecondary,
  };
}

function PlanTraceBlock({ plan }: { plan: RemediationPlan }) {
  const trace = plan.trace ?? [];

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
          Source evidence
        </span>
      </div>

      <div className="space-y-2">
        {trace.slice(0, 2).map((item, index) => (
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

function RemediationPlanCard({ plan }: { plan: RemediationPlan }) {
  return (
    <div
      className="rounded-xl border p-4 shadow-sm"
      style={{
        backgroundColor: theme.neutral.surface,
        borderColor: theme.neutral.border,
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div
            className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: theme.brand.primaryLight }}
          >
            <ListChecks className="h-4 w-4" style={{ color: theme.brand.primary }} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p style={{ fontSize: '13px', fontWeight: 800, color: theme.neutral.text }}>
                {plan.findingTitle}
              </p>

              <span
                className="rounded-full border px-2 py-0.5"
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  ...statusStyle(plan.status),
                }}
              >
                {plan.status}
              </span>
            </div>

            <p style={{ fontSize: '11px', fontWeight: 600, color: theme.brand.primary }} className="mt-1">
              Vendor: {plan.vendor} · {plan.category} · {plan.relatedArticle}
            </p>
          </div>
        </div>

        <Badge level={plan.priority} />
      </div>

      <p style={{ fontSize: '12px', lineHeight: 1.6, color: theme.neutral.textSecondary }}>
        {plan.objective}
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div
          className="rounded-lg border p-2"
          style={{
            backgroundColor: theme.neutral.background,
            borderColor: theme.neutral.border,
          }}
        >
          <div className="flex items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5" style={{ color: theme.brand.primary }} />
            <span style={{ fontSize: '10px', fontWeight: 800, color: theme.neutral.textMuted }}>
              Owner
            </span>
          </div>

          <span
            className="mt-1 inline-flex rounded-full border px-2 py-0.5"
            style={{
              fontSize: '10px',
              fontWeight: 800,
              ...ownerStyle(plan.owner),
            }}
          >
            {plan.owner}
          </span>
        </div>

        <div
          className="rounded-lg border p-2"
          style={{
            backgroundColor: theme.neutral.background,
            borderColor: theme.neutral.border,
          }}
        >
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" style={{ color: theme.brand.primary }} />
            <span style={{ fontSize: '10px', fontWeight: 800, color: theme.neutral.textMuted }}>
              Timeline
            </span>
          </div>

          <p style={{ fontSize: '11px', fontWeight: 800, color: theme.neutral.text }} className="mt-1">
            {plan.timeline}
          </p>
        </div>

        <div
          className="rounded-lg border p-2"
          style={{
            backgroundColor: theme.neutral.background,
            borderColor: theme.neutral.border,
          }}
        >
          <div className="flex items-center gap-1.5">
            <AlertTriangle
              className="h-3.5 w-3.5"
              style={{ color: severityColor(plan.priority, theme) }}
            />
            <span style={{ fontSize: '10px', fontWeight: 800, color: theme.neutral.textMuted }}>
              Priority
            </span>
          </div>

          <p style={{ fontSize: '11px', fontWeight: 800, color: theme.neutral.text }} className="mt-1">
            {plan.priority}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div>
          <p style={{ fontSize: '11px', fontWeight: 800, color: theme.neutral.text }}>
            Management actions
          </p>

          <div className="mt-2 space-y-1.5">
            {plan.actions.map((action, index) => (
              <div key={`${plan.id}-action-${index}`} className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color: theme.brand.primary }} />
                <span style={{ fontSize: '11px', lineHeight: 1.45, color: theme.neutral.textSecondary }}>
                  {action}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p style={{ fontSize: '11px', fontWeight: 800, color: theme.neutral.text }}>
            Success criteria
          </p>

          <div className="mt-2 space-y-1.5">
            {plan.successCriteria.map((criterion, index) => (
              <div key={`${plan.id}-success-${index}`} className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color: theme.status.success }} />
                <span style={{ fontSize: '11px', lineHeight: 1.45, color: theme.neutral.textSecondary }}>
                  {criterion}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <PlanTraceBlock plan={plan} />
    </div>
  );
}

export function RemediationTab() {
  const analysisResult = useAnalysisResult();
  const { scenario } = analysisResult;
  const plans = analysisResult.remediationPlans ?? [];
  const [activeFilter, setActiveFilter] = useState<RemediationFilter>('all');

  const highPriority = plans.filter((plan) => plan.priority === 'High').length;
  const open = plans.filter((plan) => plan.status === 'Open').length;
  const inProgress = plans.filter((plan) => plan.status === 'In Progress').length;
  const completed = plans.filter((plan) => plan.status === 'Completed').length;

  const filteredPlans = useMemo(() => {
    if (activeFilter === 'high') return plans.filter((plan) => plan.priority === 'High');
    if (activeFilter === 'open') return plans.filter((plan) => plan.status === 'Open');
    if (activeFilter === 'in-progress') return plans.filter((plan) => plan.status === 'In Progress');
    if (activeFilter === 'completed') return plans.filter((plan) => plan.status === 'Completed');

    return plans;
  }, [activeFilter, plans]);

  const filterButtons: Array<{
    id: RemediationFilter;
    label: string;
    count: number;
  }> = [
    { id: 'all', label: 'All', count: plans.length },
    { id: 'high', label: 'High priority', count: highPriority },
    { id: 'open', label: 'Open', count: open },
    { id: 'in-progress', label: 'In progress', count: inProgress },
    { id: 'completed', label: 'Completed', count: completed },
  ];

  const summaryCards = [
    {
      label: 'Total plans',
      value: plans.length,
      sub: 'Generated from findings',
      highlight: true,
    },
    {
      label: 'High priority',
      value: highPriority,
      sub: 'Requires urgent action',
      warning: true,
    },
    {
      label: 'Open',
      value: open,
      sub: 'Not yet started',
    },
    {
      label: 'Completed',
      value: completed,
      sub: `${inProgress} in progress`,
    },
  ];

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: theme.neutral.text }}>
            Remediation Action Plan
          </h2>

          <p style={{ fontSize: '12px', color: theme.neutral.textSecondary }} className="mt-0.5">
            {plans.length} remediation plans · {highPriority} high priority · {scenario.name}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border p-3 shadow-sm"
            style={{
              backgroundColor: card.warning
                ? theme.status.errorLight
                : card.highlight
                  ? theme.brand.primaryLight
                  : theme.neutral.surface,
              borderColor: card.warning
                ? theme.status.error
                : card.highlight
                  ? theme.brand.primaryBorder
                  : theme.neutral.border,
            }}
          >
            <p
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: card.warning
                  ? theme.status.error
                  : card.highlight
                    ? theme.brand.primary
                    : theme.neutral.text,
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
              Management focus
            </p>

            <p style={{ fontSize: '12px', lineHeight: 1.55, color: theme.neutral.textSecondary }}>
              {scenario.headlineFinding} Prioritise high-severity plans first, assign ownership, and attach evidence before formal review.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {filterButtons.map((filter) => {
          const active = activeFilter === filter.id;

          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className="rounded-full border px-3 py-1 transition-colors"
              style={{
                fontSize: '11px',
                fontWeight: 800,
                backgroundColor: active ? theme.brand.primaryLight : theme.neutral.surface,
                borderColor: active ? theme.brand.primaryBorder : theme.neutral.border,
                color: active ? theme.brand.primary : theme.neutral.textSecondary,
              }}
            >
              {filter.label} · {filter.count}
            </button>
          );
        })}
      </div>

      {plans.length === 0 ? (
        <div
          className="rounded-2xl border p-6 text-center"
          style={{
            backgroundColor: theme.neutral.surface,
            borderColor: theme.neutral.border,
          }}
        >
          <ClipboardCheck className="mx-auto h-8 w-8" style={{ color: theme.brand.primary }} />

          <p style={{ fontSize: '14px', fontWeight: 800, color: theme.neutral.text }} className="mt-3">
            No remediation plans generated yet
          </p>

          <p style={{ fontSize: '12px', color: theme.neutral.textSecondary }} className="mt-1">
            Upload or analyse a package with findings to generate action plans.
          </p>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div
          className="rounded-2xl border p-6 text-center"
          style={{
            backgroundColor: theme.neutral.surface,
            borderColor: theme.neutral.border,
          }}
        >
          <ClipboardCheck className="mx-auto h-8 w-8" style={{ color: theme.brand.primary }} />

          <p style={{ fontSize: '14px', fontWeight: 800, color: theme.neutral.text }} className="mt-3">
            No plans match this filter
          </p>

          <p style={{ fontSize: '12px', color: theme.neutral.textSecondary }} className="mt-1">
            Select another filter to view available remediation actions.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredPlans.map((plan) => (
            <RemediationPlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}
