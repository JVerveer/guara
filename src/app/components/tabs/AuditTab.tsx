import { Download, Package, CheckCircle2 } from 'lucide-react';
import { Badge } from '../Badge';

const AUDIT_ITEMS = [
  { label: 'ICT Third-Party Register', pages: 12 },
  { label: 'Critical Vendor Register', pages: 6 },
  { label: 'DORA Gap Analysis Report', pages: 18 },
  { label: 'Evidence Inventory', pages: 9 },
  { label: 'Concentration Risk Assessment', pages: 7 },
  { label: 'Remediation Action Plan', pages: 11 },
  { label: 'Review History Log', pages: 4 },
  { label: 'Audit Readiness Summary', pages: 3 },
];

export function AuditTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }} className="text-[#0F172A]">Audit Package</h2>
          <p style={{ fontSize: '13px' }} className="text-[#64748B] mt-0.5">Regulator-ready export · 8 documents</p>
        </div>
        <button className="flex items-center gap-2 bg-[#2563EB] text-white rounded-xl px-5 py-2.5 hover:bg-[#1D4ED8] transition-colors shadow-sm" style={{ fontSize: '14px', fontWeight: 600 }}>
          <Download className="w-4 h-4" />
          Download Full Package
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between">
          <span style={{ fontSize: '13px', fontWeight: 600 }} className="text-[#0F172A]">Package Contents</span>
          <span style={{ fontSize: '12px' }} className="text-[#94A3B8]">70 pages total</span>
        </div>
        <div className="divide-y divide-[#F8FAFC]">
          {AUDIT_ITEMS.map(({ label, pages }) => (
            <div key={label} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors">
              <Package className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
              <div className="flex-1">
                <p style={{ fontSize: '13px', fontWeight: 500 }} className="text-[#0F172A]">{label}</p>
                <p style={{ fontSize: '11px' }} className="text-[#94A3B8]">{pages} pages</p>
              </div>
              <Badge level="Ready" />
              <button className="text-[#64748B] hover:text-[#2563EB] transition-colors ml-1">
                <Download className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-5 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p style={{ fontSize: '14px', fontWeight: 600 }} className="text-green-800 mb-1">Audit Readiness Score: 82/100</p>
          <p style={{ fontSize: '13px', lineHeight: 1.6 }} className="text-green-700">
            Your vendor risk programme meets the core DORA requirements. Address the 5 high-severity gaps before your next regulatory review to reach 95+.
          </p>
        </div>
      </div>
    </div>
  );
}
