import { AlertTriangle, Building2, Zap } from 'lucide-react';
import { Badge } from '../Badge';
import { ALL_VENDORS, DORA_GAPS } from '../../data/constants';

export function OverviewTab() {
  const kpis = [
    { label: 'Audit Readiness', value: '82/100', sub: '+6 from last quarter', highlight: true },
    { label: 'Vendors', value: '43', sub: '8 critical' },
    { label: 'Evidence Items', value: '22', sub: '3 missing' },
    { label: 'DORA Gaps', value: '8', sub: '5 high severity' },
    { label: 'Concentration', value: 'High', sub: '65% AWS' },
    { label: 'Reviews Due', value: '4', sub: 'Next 90 days' },
  ];

  return (
    <div className="px-4 sm:px-6 py-5 space-y-5">
      {/* KPI grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {kpis.map(({ label, value, sub, highlight }) => (
          <div key={label} className={`rounded-xl border p-3 shadow-sm ${highlight ? 'bg-[#EFF6FF] border-[#BFDBFE]' : 'bg-white border-[#E2E8F0]'}`}>
            <p style={{ fontSize: 'clamp(14px, 2vw, 20px)', fontWeight: 700 }} className={highlight ? 'text-[#2563EB]' : 'text-[#0F172A]'}>{value}</p>
            <p style={{ fontSize: '10px', fontWeight: 600 }} className="text-[#0F172A] mt-0.5">{label}</p>
            <p style={{ fontSize: '10px' }} className="text-[#94A3B8] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* AI summary */}
      <div className="bg-[#0F172A] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-[#3B82F6]" />
          <span style={{ fontSize: '13px', fontWeight: 600 }} className="text-white">AI Executive Summary</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            'Analysed 8 compliance documents covering 43 vendors across cloud, payments, and SaaS.',
            '8 critical vendors — AWS, Stripe, Microsoft Azure, and Okta.',
            '8 DORA compliance gaps found — 5 high severity requiring immediate action.',
            'Concentration risk HIGH: 65% cloud dependency on a single provider (AWS).',
            '3 evidence items missing; 1 expiring within 30 days.',
            'Audit Readiness Score: 82/100 — gaps need remediation.',
          ].map((line, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-[#3B82F6] mt-0.5 flex-shrink-0">›</span>
              <span style={{ fontSize: '12px', lineHeight: 1.6 }} className="text-slate-300">{line}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Two lists */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F1F5F9]">
            <span style={{ fontSize: '12px', fontWeight: 600 }} className="text-[#0F172A]">Critical Vendors</span>
          </div>
          <div className="divide-y divide-[#F8FAFC]">
            {ALL_VENDORS.filter((v) => v.criticality === 'Critical').map((v) => (
              <div key={v.name} className="flex items-center gap-2.5 px-4 py-2.5">
                <div className="w-6 h-6 bg-[#EFF6FF] rounded-md flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: '12px', fontWeight: 500 }} className="text-[#0F172A]">{v.name}</p>
                  <p style={{ fontSize: '10px' }} className="text-[#94A3B8]">{v.service}</p>
                </div>
                <Badge level={v.risk} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F1F5F9]">
            <span style={{ fontSize: '12px', fontWeight: 600 }} className="text-[#0F172A]">Priority Gaps</span>
          </div>
          <div className="divide-y divide-[#F8FAFC]">
            {DORA_GAPS.filter((g) => g.severity === 'High').map((g) => (
              <div key={g.title} className="flex items-start gap-2.5 px-4 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: '12px', fontWeight: 500 }} className="text-[#0F172A]">{g.title}</p>
                  <p style={{ fontSize: '10px' }} className="text-[#94A3B8]">{g.vendor} · {g.article}</p>
                </div>
                <Badge level={g.severity} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
