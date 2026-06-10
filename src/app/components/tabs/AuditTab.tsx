import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '../Badge';
import { useApp } from '../../contexts/AppContext';

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

  const totalPages = AUDIT_ITEMS.reduce((sum, item) => sum + item.pages, 0);
  const recommendations = BOARD_RECOMMENDATIONS[activeScenario.id] ?? BOARD_RECOMMENDATIONS.default;

  const readinessLevel =
    activeScenario.readinessScore >= 80
      ? 'Strong'
      : activeScenario.readinessScore >= 65
        ? 'Moderate'
        : 'Needs Work';

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }} className="text-[#0F172A]">
            Board & Audit Package
          </h2>
          <p style={{ fontSize: '12px' }} className="mt-0.5 text-[#64748B]">
            {AUDIT_ITEMS.length} documents · {totalPages} pages · generated for {activeScenario.name}
          </p>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-white shadow-sm transition-colors hover:bg-[#1D4ED8]"
          style={{ fontSize: '12px', fontWeight: 700 }}
        >
          <Download className="h-3.5 w-3.5" />
          Download All
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3 shadow-sm">
          <p style={{ fontSize: '22px', fontWeight: 800 }} className="text-[#2563EB]">
            {activeScenario.readinessScore}
          </p>
          <p style={{ fontSize: '10px', fontWeight: 700 }} className="text-[#0F172A]">
            Readiness score
          </p>
          <p style={{ fontSize: '10px' }} className="text-[#64748B]">
            {readinessLevel}
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-sm">
          <p style={{ fontSize: '22px', fontWeight: 800 }} className="text-[#0F172A]">
            {activeScenario.criticalVendors}
          </p>
          <p style={{ fontSize: '10px', fontWeight: 700 }} className="text-[#0F172A]">
            Critical suppliers
          </p>
          <p style={{ fontSize: '10px' }} className="text-[#64748B]">
            Included in register
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-sm">
          <p style={{ fontSize: '22px', fontWeight: 800 }} className="text-[#0F172A]">
            {activeScenario.documents}
          </p>
          <p style={{ fontSize: '10px', fontWeight: 700 }} className="text-[#0F172A]">
            Source documents
          </p>
          <p style={{ fontSize: '10px' }} className="text-[#64748B]">
            Analysed sample files
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-sm">
          <p style={{ fontSize: '22px', fontWeight: 800 }} className="text-[#0F172A]">
            {totalPages}
          </p>
          <p style={{ fontSize: '10px', fontWeight: 700 }} className="text-[#0F172A]">
            Generated pages
          </p>
          <p style={{ fontSize: '10px' }} className="text-[#64748B]">
            Board and audit outputs
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF]">
              <ClipboardList className="h-4.5 w-4.5 text-[#2563EB]" />
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700 }} className="text-[#0F172A]">
                Executive Summary
              </p>
              <p style={{ fontSize: '11px' }} className="text-[#64748B]">
                Board-ready interpretation
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <p style={{ fontSize: '12px', lineHeight: 1.6 }} className="text-[#334155]">
              {activeScenario.name} has an audit readiness score of{' '}
              <strong>{activeScenario.readinessScore}/100</strong>. The main issue identified is{' '}
              <strong>{activeScenario.mainRisk}</strong> Guara also detected{' '}
              <strong>{activeScenario.regionExposure}</strong>, which should be reviewed in the context of
              operational resilience, vendor concentration, digital sovereignty, and regulatory readiness.
            </p>
          </div>

          <div className="mt-4 space-y-2">
            {recommendations.map((recommendation, index) => (
              <div key={recommendation} className="flex items-start gap-2 rounded-xl border border-[#E2E8F0] px-3 py-2">
                <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#EFF6FF]">
                  <span style={{ fontSize: '10px', fontWeight: 800 }} className="text-[#2563EB]">
                    {index + 1}
                  </span>
                </div>
                <p style={{ fontSize: '12px', lineHeight: 1.5 }} className="text-[#334155]">
                  {recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF]">
              <ShieldCheck className="h-4.5 w-4.5 text-[#2563EB]" />
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700 }} className="text-[#0F172A]">
                Audit Readiness Breakdown
              </p>
              <p style={{ fontSize: '11px' }} className="text-[#64748B]">
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

          <div
            className={`mt-4 flex items-start gap-2 rounded-xl border p-3 ${
              activeScenario.readinessScore >= 75
                ? 'border-[#BBF7D0] bg-[#F0FDF4]'
                : 'border-[#FED7AA] bg-[#FFF7ED]'
            }`}
          >
            {activeScenario.readinessScore >= 75 ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#EA580C]" />
            )}

            <p
              style={{ fontSize: '11px', lineHeight: 1.5 }}
              className={activeScenario.readinessScore >= 75 ? 'text-green-700' : 'text-[#9A3412]'}
            >
              {activeScenario.readinessScore >= 75
                ? 'This sample is close to audit-ready, but several evidence and exit-planning items should still be validated.'
                : 'This sample requires remediation before formal audit or board review. Focus on critical supplier governance and exit strategy coverage first.'}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="border-b border-[#F1F5F9] px-4 py-3">
          <p style={{ fontSize: '13px', fontWeight: 700 }} className="text-[#0F172A]">
            Generated Package
          </p>
        </div>

        <div className="divide-y divide-[#F8FAFC]">
          {AUDIT_ITEMS.map(({ label, pages, type }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#F8FAFC]">
              <Package className="h-4 w-4 flex-shrink-0 text-[#2563EB]" />

              <div className="flex-1">
                <p style={{ fontSize: '13px', fontWeight: 600 }} className="text-[#0F172A]">
                  {label}
                </p>
                <p style={{ fontSize: '10px' }} className="text-[#94A3B8]">
                  {pages} pages · {type}
                </p>
              </div>

              <Badge level="Ready" />

              <button type="button" className="ml-1 p-1 text-[#64748B] transition-colors hover:text-[#2563EB]">
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />

          <div>
            <p style={{ fontSize: '13px', fontWeight: 700 }} className="mb-1 text-green-800">
              Package generated for review
            </p>

            <p style={{ fontSize: '12px', lineHeight: 1.6 }} className="text-green-700">
              This sample package includes the documents a risk, compliance, audit, or board team would expect:
              supplier registers, evidence inventory, gap analysis, dependency mapping, concentration risk, and
              remediation actions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
