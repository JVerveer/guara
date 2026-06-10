import { ClipboardList, Download } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

const BOARD_RISKS: Record<string, string[]> = {
  'fintech-payments': [
    'High dependency on AWS for critical payment workloads.',
    'Stripe concentration across payment acceptance and settlement.',
    'Missing AWS exit strategy and substitutability plan.',
    'Evidence gaps in business continuity documentation.',
    'US provider dependency across critical infrastructure.',
  ],
  'digital-bank': [
    'Critical supplier governance gaps across ICT providers.',
    'Missing exit strategies for several infrastructure vendors.',
    'Annual vendor reviews incomplete for critical services.',
    'Mixed EU and US data processing creates oversight complexity.',
    'Board reporting lacks consolidated technology dependency view.',
  ],
  'european-neobank': [
    'Severe hyperscaler and financial infrastructure concentration.',
    'Low audit readiness score compared with peer scenarios.',
    'Critical service dependency map shows multiple single points of failure.',
    'Non-EU infrastructure exposure is high.',
    'Exit and continuity plans require immediate validation.',
  ],
  default: [
    'Critical technology dependencies require executive attention.',
    'Vendor evidence coverage is incomplete.',
    'Concentration risk exists across core service providers.',
    'Data residency and cross-border processing require review.',
    'Audit readiness can improve through targeted remediation.',
  ],
};

export function BoardBriefReport() {
  const { activeScenario } = useApp();
  const risks = BOARD_RISKS[activeScenario.id] ?? BOARD_RISKS.default;

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF]">
            <ClipboardList className="h-4.5 w-4.5 text-[#2563EB]" />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700 }} className="text-[#0F172A]">
              Board briefing
            </h3>
            <p style={{ fontSize: '12px' }} className="text-[#64748B]">
              Executive-ready summary for risk, audit, and technology committees.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-white"
          style={{ fontSize: '12px', fontWeight: 700 }}
        >
          <Download className="h-3.5 w-3.5" />
          PDF
        </button>
      </div>

      <div className="mb-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
        <p style={{ fontSize: '12px', fontWeight: 700 }} className="mb-1 text-[#0F172A]">
          Executive summary
        </p>
        <p style={{ fontSize: '12px', lineHeight: 1.55 }} className="text-[#64748B]">
          {activeScenario.name} has a readiness score of {activeScenario.readinessScore}/100.
          The primary concern is: {activeScenario.mainRisk}
        </p>
      </div>

      <div className="space-y-2">
        {risks.map((risk, index) => (
          <div key={risk} className="flex items-start gap-2 rounded-xl border border-[#E2E8F0] px-3 py-2">
            <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#EFF6FF]">
              <span style={{ fontSize: '10px', fontWeight: 800 }} className="text-[#2563EB]">
                {index + 1}
              </span>
            </div>
            <p style={{ fontSize: '12px', lineHeight: 1.55 }} className="text-[#334155]">
              {risk}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
