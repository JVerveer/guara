import { AlertTriangle, Building2, Zap } from 'lucide-react';
import { Badge } from '../Badge';
import { ALL_VENDORS, DORA_GAPS } from '../../data/constants';

export function OverviewTab() {
  const kpis = [
    { label: 'Audit Readiness', value: '82/100', sub: '+6 from last quarter', highlight: true },
    { label: 'Vendors Identified', value: '43', sub: '8 critical' },
    { label: 'Evidence Items', value: '22', sub: '3 missing' },
    { label: 'DORA Gaps', value: '8', sub: '5 high severity' },
    { label: 'Concentration Risk', value: 'High', sub: '65% AWS dependency' },
    { label: 'Reviews Due', value: '4', sub: 'Next 90 days' },
  ];

  return (
    <div>
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {kpis.map(({ label, value, sub, highlight }) => (
          <div key={label} className={`rounded-xl border p-4 shadow-sm ${highlight ? 'bg-[#EFF6FF] border-[#BFDBFE] col-span-2 md:col-span-1' : 'bg-white border-[#E2E8F0]'}`}>
            <p style={{ fontSize: '22px', fontWeight: 700 }} className={highlight ? 'text-[#2563EB]' : 'text-[#0F172A]'}>{value}</p>
            <p style={{ fontSize: '11px', fontWeight: 600 }} className="text-[#0F172A] mt-0.5">{label}</p>
            <p style={{ fontSize: '11px' }} className="text-[#94A3B8] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* AI Executive Summary */}
      <div className="bg-[#0F172A] rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-[#3B82F6]" />
          <span style={{ fontSize: '14px', fontWeight: 600 }} className="text-white">AI Executive Summary</span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            'Analysed 8 compliance documents covering 43 vendors across cloud, payments, and SaaS.',
            '8 critical vendors identified including AWS, Stripe, Microsoft Azure, and Okta.',
            '8 DORA compliance gaps found — 5 high severity requiring immediate action.',
            'Concentration risk is HIGH: 65% cloud dependency on a single provider (AWS).',
            '24 evidence items required; 3 are missing and 1 is expiring within 30 days.',
            'Audit Readiness Score: 82/100 — above threshold but gaps need remediation.',
          ].map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[#3B82F6] mt-0.5 flex-shrink-0">›</span>
              <span style={{ fontSize: '13px', lineHeight: 1.6 }} className="text-slate-300">{line}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Critical vendors + priority gaps */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F1F5F9]">
            <span style={{ fontSize: '13px', fontWeight: 600 }} className="text-[#0F172A]">Critical Vendors</span>
          </div>
          <div className="divide-y divide-[#F8FAFC]">
            {ALL_VENDORS.filter((v) => v.criticality === 'Critical').map((v) => (
              <div key={v.name} className="flex items-center gap-3 px-5 py-3">
                <div className="w-7 h-7 bg-[#EFF6FF] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-[#2563EB]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: '13px', fontWeight: 500 }} className="text-[#0F172A]">{v.name}</p>
                  <p style={{ fontSize: '11px' }} className="text-[#94A3B8]">{v.service}</p>
                </div>
                <Badge level={v.risk} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#F1F5F9]">
            <span style={{ fontSize: '13px', fontWeight: 600 }} className="text-[#0F172A]">Priority Gaps</span>
          </div>
          <div className="divide-y divide-[#F8FAFC]">
            {DORA_GAPS.filter((g) => g.severity === 'High').map((g) => (
              <div key={g.title} className="flex items-start gap-3 px-5 py-3">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: '13px', fontWeight: 500 }} className="text-[#0F172A]">{g.title}</p>
                  <p style={{ fontSize: '11px' }} className="text-[#94A3B8]">{g.vendor} · {g.article}</p>
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
