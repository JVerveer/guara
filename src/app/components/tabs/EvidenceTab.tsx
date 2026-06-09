import { FileText } from 'lucide-react';
import { Badge } from '../Badge';
import { EVIDENCE_ITEMS } from '../../data/constants';

export function EvidenceTab() {
  return (
    <div>
      <div className="mb-5">
        <h2 style={{ fontSize: '18px', fontWeight: 700 }} className="text-[#0F172A]">Evidence Library</h2>
        <p style={{ fontSize: '13px' }} className="text-[#64748B] mt-0.5">22 evidence items · 3 requiring action</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
              {['Evidence', 'Vendor', 'Type', 'Status', 'Expires'].map((h) => (
                <th key={h} className="px-5 py-3 text-left" style={{ fontSize: '11px', fontWeight: 600 }}>
                  <span className="text-[#94A3B8] uppercase tracking-wide">{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EVIDENCE_ITEMS.map((e, i) => (
              <tr key={e.name} className={`border-b border-[#F8FAFC] hover:bg-[#F8FAFC] transition-colors ${i === EVIDENCE_ITEMS.length - 1 ? 'border-0' : ''}`}>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#2563EB]" />
                    <span style={{ fontSize: '13px', fontWeight: 500 }} className="text-[#0F172A]">{e.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5" style={{ fontSize: '13px' }}><span className="text-[#64748B]">{e.vendor}</span></td>
                <td className="px-5 py-3.5" style={{ fontSize: '13px' }}><span className="text-[#64748B]">{e.type}</span></td>
                <td className="px-5 py-3.5"><Badge level={e.status} /></td>
                <td className="px-5 py-3.5" style={{ fontSize: '13px' }}><span className="text-[#64748B]">{e.expires}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
