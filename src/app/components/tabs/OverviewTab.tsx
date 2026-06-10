import {
  AlertTriangle,
  Building2,
  Cloud,
  Database,
  Globe2,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Badge } from '../Badge';
import { ALL_VENDORS, DORA_GAPS } from '../../data/constants';
import { useApp } from '../../contexts/AppContext';

const SOVEREIGNTY_SCORES: Record<
  string,
  {
    cloud: number;
    data: number;
    ai: number;
    concentration: number;
    regulatory: number;
  }
> = {
  'fintech-payments': { cloud: 52, data: 74, ai: 61, concentration: 48, regulatory: 72 },
  'digital-bank': { cloud: 58, data: 67, ai: 70, concentration: 55, regulatory: 64 },
  'insurance-platform': { cloud: 69, data: 49, ai: 75, concentration: 68, regulatory: 81 },
  'wealth-manager': { cloud: 64, data: 72, ai: 66, concentration: 59, regulatory: 76 },
  'crypto-exchange': { cloud: 45, data: 51, ai: 58, concentration: 43, regulatory: 58 },
  'sme-lending': { cloud: 61, data: 68, ai: 55, concentration: 57, regulatory: 69 },
  'payment-institution': { cloud: 49, data: 62, ai: 60, concentration: 46, regulatory: 61 },
  'regtech-saas': { cloud: 73, data: 78, ai: 42, concentration: 71, regulatory: 84 },
  'european-neobank': { cloud: 38, data: 54, ai: 47, concentration: 35, regulatory: 55 },
  'brokerage-platform': { cloud: 57, data: 63, ai: 69, concentration: 52, regulatory: 67 },
};

const DEPENDENCIES: Record<
  string,
  Array<{
    vendor: string;
    service: string;
    impact: string;
    icon: 'cloud' | 'payments' | 'identity' | 'data';
  }>
> = {
  'fintech-payments': [
    { vendor: 'AWS', service: 'Cloud infrastructure', impact: 'Payments API, customer portal, analytics', icon: 'cloud' },
    { vendor: 'Stripe', service: 'Payment processing', impact: 'Card acquiring, settlement, refunds', icon: 'payments' },
    { vendor: 'Okta', service: 'Identity access', impact: 'Employee access, admin access', icon: 'identity' },
    { vendor: 'Snowflake', service: 'Data platform', impact: 'Reporting, fraud analytics', icon: 'data' },
  ],
  'digital-bank': [
    { vendor: 'Microsoft Azure', service: 'Cloud infrastructure', impact: 'Mobile banking, APIs, monitoring', icon: 'cloud' },
    { vendor: 'Okta', service: 'Identity access', impact: 'Privileged access, workforce identity', icon: 'identity' },
    { vendor: 'Salesforce', service: 'CRM platform', impact: 'Customer service, onboarding', icon: 'data' },
    { vendor: 'AWS', service: 'Data processing', impact: 'Analytics and internal reporting', icon: 'cloud' },
  ],
  'insurance-platform': [
    { vendor: 'Microsoft Azure', service: 'Cloud infrastructure', impact: 'Claims platform, customer portal', icon: 'cloud' },
    { vendor: 'Salesforce', service: 'CRM platform', impact: 'Policyholder service, sales workflows', icon: 'data' },
    { vendor: 'Okta', service: 'Identity access', impact: 'Workforce identity, privileged access', icon: 'identity' },
    { vendor: 'Snowflake', service: 'Data warehouse', impact: 'Policy analytics, reporting', icon: 'data' },
  ],
  default: [
    { vendor: 'AWS', service: 'Cloud infrastructure', impact: 'Production workloads and data processing', icon: 'cloud' },
    { vendor: 'Stripe', service: 'Payments', impact: 'Customer payments and settlement', icon: 'payments' },
    { vendor: 'Okta', service: 'Identity access', impact: 'Authentication and access management', icon: 'identity' },
    { vendor: 'Snowflake', service: 'Data platform', impact: 'Reporting and analytics', icon: 'data' },
  ],
};

const BOARD_RISKS: Record<string, string[]> = {
  'fintech-payments': [
    'High dependency on AWS and Stripe for critical payment operations.',
    'No documented exit strategy found for AWS.',
    'US provider dependency across critical infrastructure.',
  ],
  'digital-bank': [
    'Missing exit strategies for multiple critical ICT providers.',
    'Annual review evidence appears incomplete for critical suppliers.',
    'Mixed EU and US processing creates oversight complexity.',
  ],
  'insurance-platform': [
    'Sensitive policyholder data is processed by several non-EU vendors.',
    'Data residency exposure requires review before audit.',
    'Critical vendor dependency map should be validated by business owners.',
  ],
  default: [
    'Critical technology dependencies require executive attention.',
    'Vendor evidence coverage is incomplete.',
    'Concentration risk exists across core service providers.',
  ],
};

function DependencyIcon({ type }: { type: 'cloud' | 'payments' | 'identity' | 'data' }) {
  if (type === 'cloud') return <Cloud className="h-3.5 w-3.5 text-[#2563EB]" />;
  if (type === 'identity') return <KeyRound className="h-3.5 w-3.5 text-[#2563EB]" />;
  return <Database className="h-3.5 w-3.5 text-[#2563EB]" />;
}

export function OverviewTab() {
  const { activeScenario } = useApp();

  const sovereigntyScores = SOVEREIGNTY_SCORES[activeScenario.id] ?? SOVEREIGNTY_SCORES['fintech-payments'];
  const sovereigntyScore = Math.round(
    (sovereigntyScores.cloud +
      sovereigntyScores.data +
      sovereigntyScores.ai +
      sovereigntyScores.concentration +
      sovereigntyScores.regulatory) /
      5,
  );

  const dependencies = DEPENDENCIES[activeScenario.id] ?? DEPENDENCIES.default;
  const boardRisks = BOARD_RISKS[activeScenario.id] ?? BOARD_RISKS.default;

  const highGaps = DORA_GAPS.filter((gap) => gap.severity === 'High');

  const kpis = [
    {
      label: 'Readiness',
      value: `${activeScenario.readinessScore}/100`,
      sub: 'Audit-ready output',
      highlight: true,
    },
    {
      label: 'Sovereignty',
      value: `${sovereigntyScore}/100`,
      sub: activeScenario.regionExposure,
    },
    {
      label: 'Vendors',
      value: String(activeScenario.vendors),
      sub: `${activeScenario.criticalVendors} critical`,
    },
    {
      label: 'Documents',
      value: String(activeScenario.documents),
      sub: 'Sample package',
    },
    {
      label: 'Concentration',
      value: activeScenario.readinessScore < 65 ? 'Severe' : 'High',
      sub: 'Critical dependency',
    },
    {
      label: 'Priority Risks',
      value: String(boardRisks.length),
      sub: 'Board-level items',
    },
  ];

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {kpis.map(({ label, value, sub, highlight }) => (
          <div
            key={label}
            className={`rounded-xl border p-3 shadow-sm ${
              highlight ? 'border-[#BFDBFE] bg-[#EFF6FF]' : 'border-[#E2E8F0] bg-white'
            }`}
          >
            <p
              style={{ fontSize: 'clamp(14px, 2vw, 20px)', fontWeight: 800 }}
              className={highlight ? 'text-[#2563EB]' : 'text-[#0F172A]'}
            >
              {value}
            </p>
            <p style={{ fontSize: '10px', fontWeight: 700 }} className="mt-0.5 text-[#0F172A]">
              {label}
            </p>
            <p style={{ fontSize: '10px' }} className="mt-0.5 truncate text-[#94A3B8]">
              {sub}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-[#0F172A] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-[#3B82F6]" />
          <span style={{ fontSize: '13px', fontWeight: 700 }} className="text-white">
            AI Executive Summary
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {[
            `Analysed ${activeScenario.documents} documents for a ${activeScenario.industry.toLowerCase()} scenario covering ${activeScenario.vendors} vendors.`,
            `${activeScenario.criticalVendors} critical vendors identified across technology, data, infrastructure, and operational services.`,
            activeScenario.headlineFinding,
            activeScenario.mainRisk,
            `Digital sovereignty exposure: ${activeScenario.regionExposure}.`,
            `Audit readiness score: ${activeScenario.readinessScore}/100 — priority remediation recommended before formal review.`,
          ].map((line) => (
            <div key={line} className="flex items-start gap-1.5">
              <span className="mt-0.5 flex-shrink-0 text-[#3B82F6]">›</span>
              <span style={{ fontSize: '12px', lineHeight: 1.6 }} className="text-slate-300">
                {line}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF]">
                <Globe2 className="h-4.5 w-4.5 text-[#2563EB]" />
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700 }} className="text-[#0F172A]">
                  Digital Sovereignty Score
                </p>
                <p style={{ fontSize: '11px' }} className="text-[#64748B]">
                  Cloud, data, AI, and concentration exposure
                </p>
              </div>
            </div>

            <div className="text-right">
              <p style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em' }} className="text-[#0F172A]">
                {sovereigntyScore}
              </p>
              <p style={{ fontSize: '10px', fontWeight: 700 }} className="text-[#64748B]">
                /100
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {[
              ['Cloud sovereignty', sovereigntyScores.cloud],
              ['Data residency', sovereigntyScores.data],
              ['AI sovereignty', sovereigntyScores.ai],
              ['Vendor concentration', sovereigntyScores.concentration],
              ['Regulatory readiness', sovereigntyScores.regulatory],
            ].map(([label, value]) => (
              <div key={label as string}>
                <div className="mb-1 flex justify-between">
                  <span style={{ fontSize: '11px', fontWeight: 600 }} className="text-[#334155]">
                    {label}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 800 }} className="text-[#0F172A]">
                    {value}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#E2E8F0]">
                  <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#FED7AA] bg-[#FFF7ED] p-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#EA580C]" />
            <p style={{ fontSize: '11px', lineHeight: 1.5 }} className="text-[#9A3412]">
              Main concern: {activeScenario.regionExposure}. {activeScenario.mainRisk}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF]">
              <Building2 className="h-4.5 w-4.5 text-[#2563EB]" />
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700 }} className="text-[#0F172A]">
                Technology Dependency Map
              </p>
              <p style={{ fontSize: '11px' }} className="text-[#64748B]">
                Providers supporting critical business operations
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {dependencies.map((dependency) => (
              <div key={dependency.vendor} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white">
                    <DependencyIcon type={dependency.icon} />
                  </div>
                  <div className="min-w-0">
                    <p style={{ fontSize: '12px', fontWeight: 800 }} className="truncate text-[#0F172A]">
                      {dependency.vendor}
                    </p>
                    <p style={{ fontSize: '10px' }} className="truncate text-[#94A3B8]">
                      {dependency.service}
                    </p>
                  </div>
                </div>

                <p style={{ fontSize: '11px', lineHeight: 1.45 }} className="text-[#64748B]">
                  Impacts: {dependency.impact}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
          <div className="border-b border-[#F1F5F9] px-4 py-3">
            <span style={{ fontSize: '12px', fontWeight: 700 }} className="text-[#0F172A]">
              Critical Vendors
            </span>
          </div>

          <div className="divide-y divide-[#F8FAFC]">
            {ALL_VENDORS.filter((vendor) => vendor.criticality === 'Critical').map((vendor) => (
              <div key={vendor.name} className="flex items-center gap-2.5 px-4 py-2.5">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-[#EFF6FF]">
                  <Building2 className="h-3.5 w-3.5 text-[#2563EB]" />
                </div>

                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: '12px', fontWeight: 600 }} className="text-[#0F172A]">
                    {vendor.name}
                  </p>
                  <p style={{ fontSize: '10px' }} className="text-[#94A3B8]">
                    {vendor.service} · {vendor.country}
                  </p>
                </div>

                <Badge level={vendor.risk} />
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
          <div className="border-b border-[#F1F5F9] px-4 py-3">
            <span style={{ fontSize: '12px', fontWeight: 700 }} className="text-[#0F172A]">
              Board-Level Priority Risks
            </span>
          </div>

          <div className="divide-y divide-[#F8FAFC]">
            {boardRisks.map((risk, index) => (
              <div key={risk} className="flex items-start gap-2.5 px-4 py-2.5">
                <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#EFF6FF]">
                  <span style={{ fontSize: '10px', fontWeight: 800 }} className="text-[#2563EB]">
                    {index + 1}
                  </span>
                </div>

                <p style={{ fontSize: '12px', lineHeight: 1.5 }} className="text-[#334155]">
                  {risk}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="border-b border-[#F1F5F9] px-4 py-3">
          <span style={{ fontSize: '12px', fontWeight: 700 }} className="text-[#0F172A]">
            Highest Severity Gaps
          </span>
        </div>

        <div className="divide-y divide-[#F8FAFC]">
          {highGaps.slice(0, 4).map((gap) => (
            <div key={`${gap.title}-${gap.vendor}`} className="flex items-start gap-2.5 px-4 py-2.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" />

              <div className="min-w-0 flex-1">
                <p style={{ fontSize: '12px', fontWeight: 600 }} className="text-[#0F172A]">
                  {gap.title}
                </p>
                <p style={{ fontSize: '10px' }} className="text-[#94A3B8]">
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
