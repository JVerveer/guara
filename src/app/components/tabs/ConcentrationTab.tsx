import { Cloud } from 'lucide-react';
import { Badge } from '../Badge';
import { CLOUD_RISK } from '../../data/constants';

const RISK_ASSESSMENTS = [
  { title: 'Single-provider dependency', severity: 'High', desc: '65% of cloud workloads on AWS. Any outage creates critical business disruption.' },
  { title: 'Geographic concentration', severity: 'Medium', desc: 'All three providers operate in overlapping regions. No geographic redundancy.' },
  { title: 'Vendor lock-in risk', severity: 'High', desc: 'High AWS dependency with no documented exit strategy or migration plan.' },
  { title: 'Cost concentration', severity: 'Low', desc: '€828K annual cloud spend in 3 vendors — moderate financial exposure.' },
];

export function ConcentrationTab() {
  return (
    <div className="px-4 sm:px-6 py-5">
      <div className="mb-4">
        <h2 style={{ fontSize: '16px', fontWeight: 700 }} className="text-[#0F172A]">Concentration Risk</h2>
        <p style={{ fontSize: '12px' }} className="text-[#64748B] mt-0.5">Cloud provider dependency analysis</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Bars */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p style={{ fontSize: '13px', fontWeight: 600 }} className="text-[#0F172A]">Cloud Dependency</p>
            <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full" style={{ fontSize: '10px', fontWeight: 600 }}>High Risk</span>
          </div>
          <div className="space-y-4">
            {CLOUD_RISK.map(({ label, pct, color, spend }) => (
              <div key={label}>
                <div className="flex justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5" style={{ color }} />
                    <span style={{ fontSize: '13px', fontWeight: 500 }} className="text-[#0F172A]">{label}</span>
                    <span style={{ fontSize: '11px' }} className="text-[#94A3B8]">{spend}/yr</span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 700 }} className="text-[#0F172A]">{pct}%</span>
                </div>
                <div className="h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk cards */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
          <p style={{ fontSize: '13px', fontWeight: 600 }} className="text-[#0F172A] mb-3">Risk Assessment</p>
          <div className="space-y-2.5">
            {RISK_ASSESSMENTS.map(({ title, severity, desc }) => (
              <div key={title} className="border border-[#E2E8F0] rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p style={{ fontSize: '12px', fontWeight: 600 }} className="text-[#0F172A]">{title}</p>
                  <Badge level={severity} />
                </div>
                <p style={{ fontSize: '11px', lineHeight: 1.6 }} className="text-[#64748B]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
