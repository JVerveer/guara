import { AlertTriangle, Download } from 'lucide-react';
import { Badge } from '../Badge';
import { DORA_GAPS } from '../../data/constants';

export function GapsTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }} className="text-[#0F172A]">DORA Gap Analysis</h2>
          <p style={{ fontSize: '13px' }} className="text-[#64748B] mt-0.5">8 gaps identified · 5 high severity</p>
        </div>
        <button className="flex items-center gap-1.5 border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#64748B] hover:bg-[#F8FAFC] transition-colors" style={{ fontSize: '13px' }}>
          <Download className="w-3.5 h-3.5" /> Export Gap Report
        </button>
      </div>

      <div className="space-y-3">
        {DORA_GAPS.map((g) => (
          <div key={g.title} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5 hover:border-[#CBD5E1] transition-colors">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${g.severity === 'High' ? 'text-red-500' : g.severity === 'Medium' ? 'text-amber-500' : 'text-green-500'}`} />
                <p style={{ fontSize: '14px', fontWeight: 600 }} className="text-[#0F172A]">{g.title}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span style={{ fontSize: '11px' }} className="text-[#94A3B8] bg-[#F1F5F9] px-2 py-0.5 rounded-full font-mono">{g.article}</span>
                <Badge level={g.severity} />
              </div>
            </div>
            <p style={{ fontSize: '12px', fontWeight: 500 }} className="text-[#2563EB] mb-1">Vendor: {g.vendor}</p>
            <p style={{ fontSize: '13px', lineHeight: 1.6 }} className="text-[#64748B]">{g.rec}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
