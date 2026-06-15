import {
  AlertTriangle,
  Cloud,
  CloudOff,
  Download,
  Globe2,
  ServerCrash,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '../Badge';
import { CLOUD_RISK } from '../../data/constants';
import { useApp } from '../../contexts/AppContext';
import { theme } from '../../../styles/theme';

const SIMULATIONS: Record<
  string,
  {
    provider: string;
    affectedDependencies: number;
    affectedServices: string[];
    impact: 'Medium' | 'High' | 'Severe';
    recovery: string;
    recommendation: string;
  }
> = {
  'fintech-payments': {
    provider: 'AWS',
    affectedDependencies: 14,
    affectedServices: ['Payments API', 'Customer portal', 'Fraud monitoring', 'Analytics'],
    impact: 'High',
    recovery: '5–10 days without documented exit plan',
    recommendation: 'Document AWS substitutability and validate failover for payment-critical services.',
  },
  'digital-bank': {
    provider: 'Microsoft Azure',
    affectedDependencies: 22,
    affectedServices: ['Mobile banking', 'API gateway', 'Monitoring', 'Internal identity integrations'],
    impact: 'High',
    recovery: '7–14 days due to missing exit strategies',
    recommendation: 'Run a critical ICT provider outage exercise and validate recovery ownership.',
  },
  'insurance-platform': {
    provider: 'Microsoft Azure',
    affectedDependencies: 11,
    affectedServices: ['Claims platform', 'Policyholder portal', 'Reporting', 'Document workflows'],
    impact: 'High',
    recovery: '4–8 days depending on backup region readiness',
    recommendation: 'Validate claims-processing continuity and confirm backup processing locations.',
  },
  'european-neobank': {
    provider: 'AWS and core banking provider',
    affectedDependencies: 31,
    affectedServices: ['Core ledger', 'Customer onboarding', 'Payments', 'Customer support'],
    impact: 'Severe',
    recovery: '10–20 days without validated contingency plan',
    recommendation: 'Prioritise board-level review of hyperscaler and financial infrastructure concentration.',
  },
  default: {
    provider: 'Primary cloud provider',
    affectedDependencies: 12,
    affectedServices: ['Customer portal', 'Data warehouse', 'Internal analytics', 'API services'],
    impact: 'High',
    recovery: '5–10 days depending on backup provider readiness',
    recommendation: 'Define exit options and test service recovery for critical technology dependencies.',
  },
};

const RISK_ASSESSMENTS = [
  {
    title: 'Single-provider dependency',
    severity: 'High',
    desc: 'A large share of critical workloads appears to rely on one provider, creating outage and substitutability risk.',
  },
  {
    title: 'Digital sovereignty exposure',
    severity: 'High',
    desc: 'Critical infrastructure and data workflows rely heavily on non-EU technology providers.',
  },
  {
    title: 'Exit strategy gap',
    severity: 'High',
    desc: 'No complete vendor exit strategy or migration path is documented for the primary provider.',
  },
  {
    title: 'Geographic resilience',
    severity: 'Medium',
    desc: 'Provider regions and recovery locations should be reviewed against business continuity requirements.',
  },
];

export function ConcentrationTab() {
  const { activeScenario } = useApp();

  const simulation = SIMULATIONS[activeScenario.id] ?? SIMULATIONS.default;
  const topProvider = CLOUD_RISK[0];

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
            Concentration & Dependency Risk
          </h2>

          <p
            style={{
              fontSize: '12px',
              color: theme.neutral.textSecondary,
            }}
            className="mt-0.5"
          >
            Cloud, hyperscaler, sovereignty, and outage impact analysis
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
          onMouseEnter={(event) => {
            event.currentTarget.style.backgroundColor = theme.neutral.background;
            event.currentTarget.style.borderColor = theme.neutral.borderStrong;
            event.currentTarget.style.color = theme.neutral.text;
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.backgroundColor = theme.neutral.surface;
            event.currentTarget.style.borderColor = theme.neutral.border;
            event.currentTarget.style.color = theme.neutral.textSecondary;
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          {
            label: 'Primary provider',
            value: topProvider.label,
            sub: `${topProvider.pct}% cloud dependency`,
            warning: false,
          },
          {
            label: 'Outage impact',
            value: simulation.impact,
            sub: `${simulation.affectedDependencies} dependencies affected`,
            warning: true,
          },
          {
            label: 'Recovery estimate',
            value: simulation.recovery.split(' ')[0],
            sub: simulation.recovery,
            warning: false,
          },
          {
            label: 'Sovereignty exposure',
            value: 'High',
            sub: activeScenario.regionExposure,
            warning: false,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border p-3 shadow-sm"
            style={{
              backgroundColor: card.warning
                ? theme.status.warningLight
                : theme.neutral.surface,
              borderColor: card.warning
                ? theme.status.warning
                : theme.neutral.border,
            }}
          >
            <p
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: card.warning
                  ? theme.status.warning
                  : theme.neutral.text,
              }}
            >
              {card.value}
            </p>

            <p
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: theme.neutral.text,
              }}
              className="mt-0.5"
            >
              {card.label}
            </p>

            <p
              style={{
                fontSize: '10px',
                color: theme.neutral.textMuted,
              }}
              className="mt-0.5 truncate"
            >
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
          <ServerCrash
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            style={{ color: theme.status.warning }}
          />

          <div>
            <p
              style={{
                fontSize: '13px',
                fontWeight: 800,
                color: theme.neutral.text,
              }}
            >
              Outage simulation: {simulation.provider} unavailable
            </p>

            <p
              style={{
                fontSize: '12px',
                lineHeight: 1.55,
                color: theme.neutral.textSecondary,
              }}
            >
              {simulation.affectedDependencies} dependencies would be affected. Estimated recovery:{' '}
              {simulation.recovery}. {simulation.recommendation}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div
          className="rounded-2xl border p-5 shadow-sm"
          style={{
            backgroundColor: theme.neutral.surface,
            borderColor: theme.neutral.border,
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: theme.brand.primaryLight }}
              >
                <Cloud
                  className="h-4.5 w-4.5"
                  style={{ color: theme.brand.primary }}
                />
              </div>

              <div>
                <p
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: theme.neutral.text,
                  }}
                >
                  Cloud Dependency
                </p>

                <p
                  style={{
                    fontSize: '11px',
                    color: theme.neutral.textSecondary,
                  }}
                >
                  Provider share and annual spend
                </p>
              </div>
            </div>

            <span
              className="rounded-full border px-2 py-0.5"
              style={{
                fontSize: '10px',
                fontWeight: 700,
                backgroundColor: theme.status.errorLight,
                borderColor: theme.status.error,
                color: theme.status.error,
              }}
            >
              High Risk
            </span>
          </div>

          <div className="space-y-4">
            {CLOUD_RISK.map(({ label, pct, spend }, index) => {
              const barColor =
                index === 0
                  ? theme.brand.primary
                  : index === 1
                    ? theme.status.info
                    : theme.neutral.textMuted;

              return (
                <div key={label}>
                  <div className="mb-1.5 flex justify-between">
                    <div className="flex items-center gap-1.5">
                      <Cloud
                        className="h-3.5 w-3.5"
                        style={{ color: barColor }}
                      />

                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: theme.neutral.text,
                        }}
                      >
                        {label}
                      </span>

                      <span
                        style={{
                          fontSize: '11px',
                          color: theme.neutral.textMuted,
                        }}
                      >
                        {spend}/yr
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 800,
                        color: theme.neutral.text,
                      }}
                    >
                      {pct}%
                    </span>
                  </div>

                  <div
                    className="h-2 overflow-hidden rounded-full"
                    style={{ backgroundColor: theme.neutral.border }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="mt-4 rounded-xl border p-3"
            style={{
              backgroundColor: theme.neutral.background,
              borderColor: theme.neutral.border,
            }}
          >
            <p
              style={{
                fontSize: '11px',
                lineHeight: 1.5,
                color: theme.neutral.textSecondary,
              }}
            >
              Guara interprets high provider share as a concentration signal when the provider
              supports critical services, regulated data, or operational continuity.
            </p>
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
              style={{ backgroundColor: theme.status.warningLight }}
            >
              <CloudOff
                className="h-4.5 w-4.5"
                style={{ color: theme.status.warning }}
              />
            </div>

            <div>
              <p
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: theme.neutral.text,
                }}
              >
                Services affected in outage scenario
              </p>

              <p
                style={{
                  fontSize: '11px',
                  color: theme.neutral.textSecondary,
                }}
              >
                Business impact view for {activeScenario.name}
              </p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <div
              className="rounded-xl border p-3"
              style={{
                backgroundColor: theme.neutral.background,
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
                {simulation.affectedDependencies}
              </p>

              <p
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: theme.neutral.textSecondary,
                }}
              >
                affected dependencies
              </p>
            </div>

            <div
              className="rounded-xl border p-3"
              style={{
                backgroundColor: theme.status.warningLight,
                borderColor: theme.status.warning,
              }}
            >
              <p
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  color: theme.status.warning,
                }}
              >
                {simulation.impact}
              </p>

              <p
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: theme.neutral.text,
                }}
              >
                business impact
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {simulation.affectedServices.map((service) => (
              <div
                key={service}
                className="flex items-center justify-between rounded-xl border px-3 py-2"
                style={{
                  backgroundColor: theme.neutral.background,
                  borderColor: theme.neutral.border,
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: theme.neutral.textSecondary,
                  }}
                >
                  {service}
                </span>

                <Badge level="High" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div
          className="rounded-2xl border p-5 shadow-sm"
          style={{
            backgroundColor: theme.neutral.surface,
            borderColor: theme.neutral.border,
          }}
        >
          <p
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: theme.neutral.text,
            }}
            className="mb-3"
          >
            Risk Assessment
          </p>

          <div className="space-y-2.5">
            {RISK_ASSESSMENTS.map(({ title, severity, desc }) => (
              <div
                key={title}
                className="rounded-xl border p-3"
                style={{
                  backgroundColor: theme.neutral.surface,
                  borderColor: theme.neutral.border,
                }}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: theme.neutral.text,
                    }}
                  >
                    {title}
                  </p>

                  <Badge level={severity} />
                </div>

                <p
                  style={{
                    fontSize: '11px',
                    lineHeight: 1.6,
                    color: theme.neutral.textSecondary,
                  }}
                >
                  {desc}
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
              <Globe2
                className="h-4.5 w-4.5"
                style={{ color: theme.brand.primary }}
              />
            </div>

            <div>
              <p
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: theme.neutral.text,
                }}
              >
                Digital sovereignty view
              </p>

              <p
                style={{
                  fontSize: '11px',
                  color: theme.neutral.textSecondary,
                }}
              >
                Strategic dependency on non-EU providers
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {[
              ['US infrastructure dependency', 'High'],
              ['EU data processing coverage', 'Partial'],
              ['Exit strategy maturity', 'Low'],
              ['Provider substitutability', 'Limited'],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl border px-3 py-2"
                style={{
                  backgroundColor: theme.neutral.background,
                  borderColor: theme.neutral.border,
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
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
              {activeScenario.regionExposure}. This should be reviewed as part of operational
              resilience and strategic technology dependency planning.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
