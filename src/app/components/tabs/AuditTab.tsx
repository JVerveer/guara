import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '../Badge';
import { useApp } from '../../contexts/AppContext';
import { ConversionModal } from '../ui/ConversionModal';
import { theme } from '../../../styles/theme';

type ConversionIntent = 'save' | 'export' | 'upload';

const AUDIT_ITEMS = [
  { label: 'Technology Dependency Map', pages: 8, type: 'Board Pack' },
  { label: 'Critical Supplier Register', pages: 6, type: 'Register' },
  { label: 'DORA ICT Third-Party Register', pages: 12, type: 'Regulatory' },
  { label: 'Gap & Risk Analysis Report', pages: 18, type: 'Risk Report' },
  { label: 'Evidence Inventory', pages: 9, type: 'Evidence' },
  { label: 'Concentration Risk Assessment', pages: 7, type: 'Risk Report' },
  { label: 'Digital Sovereignty Summary', pages: 5, type: 'Board Pack' },
  { label: 'Remediation Action Plan', pages: 11, type: 'Action Plan' },
  { label: 'Audit Readiness Summary', pages: 3, type: 'Executive Summary' },
];

const BOARD_RECOMMENDATIONS: Record<string, string[]> = {
  'fintech-payments': [
    'Validate AWS exit strategy and payment continuity plan.',
    'Review Stripe concentration and settlement dependency.',
    'Document US provider dependency for board-level technology risk oversight.',
  ],
  'digital-bank': [
    'Prioritise missing exit strategies for critical ICT providers.',
    'Complete annual review evidence for high-impact suppliers.',
    'Validate resilience testing for infrastructure and identity providers.',
  ],
  'insurance-platform': [
    'Confirm data residency safeguards for policyholder data.',
    'Review claims-processing dependency on external cloud providers.',
    'Prepare evidence pack for continuity and recovery controls.',
  ],
  'european-neobank': [
    'Escalate hyperscaler and infrastructure dependency to board risk committee.',
    'Run critical provider outage simulation before formal review.',
    'Create remediation plan for low readiness and concentration exposure.',
  ],
  default: [
    'Validate exit strategies for critical technology providers.',
    'Close missing evidence gaps before audit review.',
    'Prepare board-level summary of cloud, AI, and data dependency exposure.',
  ],
};

export function AuditTab() {
  const { activeScenario } = useApp();
  const [modalIntent, setModalIntent] = useState<ConversionIntent | null>(null);

  const totalPages = AUDIT_ITEMS.reduce((sum, item) => sum + item.pages, 0);
  const recommendations =
    BOARD_RECOMMENDATIONS[activeScenario.id] ?? BOARD_RECOMMENDATIONS.default;

  const readinessLevel =
    activeScenario.readinessScore >= 80
      ? 'Strong'
      : activeScenario.readinessScore >= 65
        ? 'Moderate'
        : 'Needs Work';

  const isAuditReady = activeScenario.readinessScore >= 75;

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: theme.neutral.text,
            }}
          >
            Board & Audit Package
          </h2>

          <p
            style={{
              fontSize: '12px',
              color: theme.neutral.textSecondary,
            }}
            className="mt-0.5"
          >
            {AUDIT_ITEMS.length} documents · {totalPages} pages · generated for{' '}
            {activeScenario.name}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalIntent('export')}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 transition-colors"
          style={{
            fontSize: '12px',
            fontWeight: 700,
            backgroundColor: theme.brand.primary,
            color: theme.sidebar.activeText,
            boxShadow: theme.shadow.brand,
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.backgroundColor = theme.brand.primaryHover;
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.backgroundColor = theme.brand.primary;
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Download All
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div
          className="rounded-xl border p-3 shadow-sm"
          style={{
            backgroundColor: theme.brand.primaryLight,
            borderColor: theme.brand.primaryBorder,
          }}
        >
          <p
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: theme.brand.primary,
            }}
          >
            {activeScenario.readinessScore}
          </p>
          <p
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: theme.neutral.text,
            }}
          >
            Readiness score
          </p>
          <p
            style={{
              fontSize: '10px',
              color: theme.neutral.textSecondary,
            }}
          >
            {readinessLevel}
          </p>
        </div>

        {[
          {
            value: activeScenario.criticalVendors,
            label: 'Critical suppliers',
            description: 'Included in register',
          },
          {
            value: activeScenario.documents,
            label: 'Source documents',
            description: 'Analysed sample files',
          },
          {
            value: totalPages,
            label: 'Generated pages',
            description: 'Board and audit outputs',
          },
        ].map(({ value, label, description }) => (
          <div
            key={label}
            className="rounded-xl border p-3 shadow-sm"
            style={{
              backgroundColor: theme.neutral.surface,
              borderColor: theme.neutral.border,
            }}
          >
            <p
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: theme.neutral.text,
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
            >
              {label}
            </p>
            <p
              style={{
                fontSize: '10px',
                color: theme.neutral.textSecondary,
              }}
            >
              {description}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div
          className="rounded-2xl border p-5 shadow-sm"
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
              <ClipboardList
                className="h-4.5 w-4.5"
                style={{ color: theme.brand.primary }}
              />
            </div>
            <div>
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: theme.neutral.text,
                }}
              >
                Executive Summary
              </p>
              <p
                style={{
                  fontSize: '11px',
                  color: theme.neutral.textSecondary,
                }}
              >
                Board-ready interpretation
              </p>
            </div>
          </div>

          <div
            className="rounded-xl border p-4"
            style={{
              backgroundColor: theme.neutral.background,
              borderColor: theme.neutral.border,
            }}
          >
            <p
              style={{
                fontSize: '12px',
                lineHeight: 1.6,
                color: theme.neutral.textSecondary,
              }}
            >
              {activeScenario.name} has an audit readiness score of{' '}
              <strong>{activeScenario.readinessScore}/100</strong>. The main issue identified is{' '}
              <strong>{activeScenario.mainRisk}</strong> Guara also detected{' '}
              <strong>{activeScenario.regionExposure}</strong>, which should be reviewed in the
              context of operational resilience, vendor concentration, digital sovereignty, and
              regulatory readiness.
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {recommendations.map((recommendation, index) => (
              <div
                key={recommendation}
                className="flex items-start gap-2 rounded-xl border px-3 py-2"
                style={{
                  backgroundColor: theme.neutral.surface,
                  borderColor: theme.neutral.border,
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
                  {recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-2xl border p-5 shadow-sm"
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
              <ShieldCheck
                className="h-4.5 w-4.5"
                style={{ color: theme.brand.primary }}
              />
            </div>
            <div>
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: theme.neutral.text,
                }}
              >
                Audit Readiness Breakdown
              </p>
              <p
                style={{
                  fontSize: '11px',
                  color: theme.neutral.textSecondary,
                }}
              >
                Areas included in the generated pack
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              ['ICT register completeness', Math.min(96, activeScenario.readinessScore + 10)],
              ['Evidence coverage', Math.max(48, activeScenario.readinessScore - 8)],
              ['Critical supplier mapping', Math.min(94, activeScenario.readinessScore + 6)],
              ['Exit strategy coverage', Math.max(35, activeScenario.readinessScore - 24)],
              ['Concentration risk analysis', Math.min(91, activeScenario.readinessScore + 4)],
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
              backgroundColor: isAuditReady
                ? theme.status.successLight
                : theme.status.warningLight,
              borderColor: isAuditReady
                ? theme.status.success
                : theme.status.warning,
            }}
          >
            {isAuditReady ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 flex-shrink-0"
                style={{ color: theme.status.success }}
              />
            ) : (
              <AlertTriangle
                className="mt-0.5 h-4 w-4 flex-shrink-0"
                style={{ color: theme.status.warning }}
              />
            )}

            <p
              style={{
                fontSize: '11px',
                lineHeight: 1.5,
                color: theme.neutral.text,
              }}
            >
              {isAuditReady
                ? 'This sample is close to audit-ready, but several evidence and exit-planning items should still be validated.'
                : 'This sample requires remediation before formal audit or board review. Focus on critical supplier governance and exit strategy coverage first.'}
            </p>
          </div>
        </div>
      </div>

      <div
        className="mb-4 overflow-hidden rounded-2xl border shadow-sm"
        style={{
          backgroundColor: theme.neutral.surface,
          borderColor: theme.neutral.border,
        }}
      >
        <div
          className="border-b px-4 py-3"
          style={{ borderColor: theme.neutral.border }}
        >
          <p
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: theme.neutral.text,
            }}
          >
            Generated Package
          </p>
        </div>

        <div>
          {AUDIT_ITEMS.map(({ label, pages, type }, index) => (
            <div
              key={label}
              className="flex items-center gap-3 px-4 py-3 transition-colors"
              style={{
                borderTop:
                  index === 0 ? undefined : `1px solid ${theme.neutral.background}`,
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = theme.neutral.background;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = theme.neutral.surface;
              }}
            >
              <Package
                className="h-4 w-4 flex-shrink-0"
                style={{ color: theme.brand.primary }}
              />

              <div className="flex-1">
                <p
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: theme.neutral.text,
                  }}
                >
                  {label}
                </p>
                <p
                  style={{
                    fontSize: '10px',
                    color: theme.neutral.textMuted,
                  }}
                >
                  {pages} pages · {type}
                </p>
              </div>

              <Badge level="Ready" />

              <button
                type="button"
                onClick={() => setModalIntent('export')}
                className="ml-1 p-1 transition-colors"
                style={{ color: theme.neutral.textSecondary }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.color = theme.brand.primary;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.color = theme.neutral.textSecondary;
                }}
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: theme.status.successLight,
          borderColor: theme.status.success,
        }}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 h-5 w-5 flex-shrink-0"
            style={{ color: theme.status.success }}
          />

          <div>
            <p
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: theme.neutral.text,
              }}
              className="mb-1"
            >
              Package generated for review
            </p>

            <p
              style={{
                fontSize: '12px',
                lineHeight: 1.6,
                color: theme.neutral.textSecondary,
              }}
            >
              This sample package includes the documents a risk, compliance, audit, or board team
              would expect: supplier registers, evidence inventory, gap analysis, dependency
              mapping, concentration risk, and remediation actions.
            </p>
          </div>
        </div>
      </div>

      <ConversionModal
        open={modalIntent !== null}
        intent={modalIntent ?? 'export'}
        onClose={() => setModalIntent(null)}
      />
    </div>
  );
}
