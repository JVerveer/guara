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
          <h2 style={{ fontSize: '16px', fontWeight: 700 }} className="text-[#0F172A]">
            Concentration & Dependency Risk
          </h2>
          <p style={{ fontSize: '12px' }} className="mt-0.5 text-[#64748B]">
            Cloud, hyperscaler, sovereignty, and outage impact analysis
          </p>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-[#64748B] transition-colors hover:bg-[#F8FAFC]"
          style={{ fontSize: '12px' }}
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
          },
          {
            label: 'Outage impact',
            value: simulation.impact,
            sub: `${simulation.affectedDependencies} dependencies affected`,
          },
          {
            label: 'Recovery estimate',
            value: simulation.recovery.split(' ')[0],
            sub: simulation.recovery,
          },
          {
            label: 'Sovereignty exposure',
            value: 'High',
            sub: activeScenario.regionExposure,
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border p-3 shadow-sm ${
              card.label === 'Outage impact'
                ? 'border-[#FED7AA] bg-[#FFF7ED]'
                : 'border-[#E2E8F0] bg-white'
            }`}
          >
            <p
              style={{ fontSize: '18px', fontWeight: 800 }}
              className={card.label === 'Outage impact' ? 'text-[#EA580C]' : 'text-[#0F172A]'}
            >
              {card.value}
            </p>
            <p style={{ fontSize: '10px', fontWeight: 700 }} className="mt-0.5 text-[#0F172A]">
              {card.label}
            </p>
            <p style={{ fontSize: '10px' }} className="mt-0.5 truncate text-[#94A3B8]">
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-4">
        <div className="flex items-start gap-2">
          <ServerCrash className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#EA580C]" />
          <div>
            <p style={{ fontSize: '13px', fontWeight: 800 }} className="text-[#9A3412]">
              Outage simulation: {simulation.provider} unavailable
            </p>
            <p style={{ fontSize: '12px', lineHeight: 1.55 }} className="text-[#9A3412]">
              {simulation.affectedDependencies} dependencies would be affected. Estimated recovery:
              {' '}
              {simulation.recovery}. {simulation.recommendation}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF]">
                <Cloud className="h-4.5 w-4.5 text-[#2563EB]" />
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700 }} className="text-[#0F172A]">
                  Cloud Dependency
                </p>
                <p style={{ fontSize: '11px' }} className="text-[#64748B]">
                  Provider share and annual spend
                </p>
              </div>
            </div>

            <span
              className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-700"
              style={{ fontSize: '10px', fontWeight: 700 }}
            >
              High Risk
            </span>
          </div>

          <div className="space-y-4">
            {CLOUD_RISK.map(({ label, pct, color, spend }) => (
              <div key={label}>
                <div className="mb-1.5 flex justify-between">
                  <div className="flex items-center gap-1.5">
                    <Cloud className="h-3.5 w-3.5" style={{ color }} />
                    <span style={{ fontSize: '13px', fontWeight: 600 }} className="text-[#0F172A]">
                      {label}
                    </span>
                    <span style={{ fontSize: '11px' }} className="text-[#94A3B8]">
                      {spend}/yr
                    </span>
                  </div>

                  <span style={{ fontSize: '14px', fontWeight: 800 }} className="text-[#0F172A]">
                    {pct}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
            <p style={{ fontSize: '11px', lineHeight: 1.5 }} className="text-[#64748B]">
              Guara interprets high provider share as a concentration signal when the provider supports
              critical services, regulated data, or operational continuity.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF7ED]">
              <CloudOff className="h-4.5 w-4.5 text-[#EA580C]" />
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700 }} className="text-[#0F172A]">
                Services affected in outage scenario
              </p>
              <p style={{ fontSize: '11px' }} className="text-[#64748B]">
                Business impact view for {activeScenario.name}
              </p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <p style={{ fontSize: '22px', fontWeight: 800 }} className="text-[#0F172A]">
                {simulation.affectedDependencies}
              </p>
              <p style={{ fontSize: '10px', fontWeight: 700 }} className="text-[#64748B]">
                affected dependencies
              </p>
            </div>

            <div className="rounded-xl border border-[#FED7AA] bg-[#FFF7ED] p-3">
              <p style={{ fontSize: '22px', fontWeight: 800 }} className="text-[#EA580C]">
                {simulation.impact}
              </p>
              <p style={{ fontSize: '10px', fontWeight: 700 }} className="text-[#9A3412]">
                business impact
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {simulation.affectedServices.map((service) => (
              <div
                key={service}
                className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
              >
                <span style={{ fontSize: '12px', fontWeight: 600 }} className="text-[#334155]">
                  {service}
                </span>

                <Badge level="High" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <p style={{ fontSize: '13px', fontWeight: 700 }} className="mb-3 text-[#0F172A]">
            Risk Assessment
          </p>

          <div className="space-y-2.5">
            {RISK_ASSESSMENTS.map(({ title, severity, desc }) => (
              <div key={title} className="rounded-xl border border-[#E2E8F0] p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p style={{ fontSize: '12px', fontWeight: 700 }} className="text-[#0F172A]">
                    {title}
                  </p>
                  <Badge level={severity} />
                </div>

                <p style={{ fontSize: '11px', lineHeight: 1.6 }} className="text-[#64748B]">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF]">
              <Globe2 className="h-4.5 w-4.5 text-[#2563EB]" />
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700 }} className="text-[#0F172A]">
                Digital sovereignty view
              </p>
              <p style={{ fontSize: '11px' }} className="text-[#64748B]">
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
                className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
              >
                <span style={{ fontSize: '12px', fontWeight: 600 }} className="text-[#334155]">
                  {label}
                </span>

                <span style={{ fontSize: '11px', fontWeight: 800 }} className="text-[#0F172A]">
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#FED7AA] bg-[#FFF7ED] p-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#EA580C]" />
            <p style={{ fontSize: '11px', lineHeight: 1.5 }} className="text-[#9A3412]">
              {activeScenario.regionExposure}. This should be reviewed as part of operational resilience
              and strategic technology dependency planning.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
