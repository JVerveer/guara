import { Building2, Download } from 'lucide-react';
import { Badge } from '../Badge';
import { ALL_VENDORS } from '../../data/constants';

export function VendorsTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }} className="text-[#0F172A]">Vendor Inventory</h2>
          <p style={{ fontSize: '13px' }} className="text-[#64748B] mt-0.5">43 vendors identified across 8 documents</p>
        </div>
        <button className="flex items-center gap-1.5 border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#64748B] hover:bg-[#F8FAFC] transition-colors" style={{ fontSize: '13px' }}>
          <Download className="w-3.5 h-3.5" /> Export XLSX
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
              {['Vendor', 'Service', 'Criticality', 'Risk', 'Compliance Score', 'Country', 'Annual Spend'].map((h) => (
                <th key={h} className="px-5 py-3 text-left" style={{ fontSize: '11px', fontWeight: 600 }}>
                  <span className="text-[#94A3B8] uppercase tracking-wide">{h}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_VENDORS.map((v, i) => (
              <tr key={v.name} className={`border-b border-[#F8FAFC] hover:bg-[#F8FAFC] transition-colors ${i === ALL_VENDORS.length - 1 ? 'border-0' : ''}`}>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-[#EFF6FF] rounded-lg flex items-center justify-center">
                      <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 500 }} className="text-[#0F172A]">{v.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5" style={{ fontSize: '13px' }}><span className="text-[#64748B]">{v.service}</span></td>
                <td className="px-5 py-3.5"><Badge level={v.criticality} /></td>
                <td className="px-5 py-3.5"><Badge level={v.risk} /></td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 bg-[#E2E8F0] rounded-full overflow-hidden">
                      <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${v.score}%` }} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 500 }} className="text-[#0F172A]">{v.score}%</span>
                  </div>
                </td>
                <td className="px-5 py-3.5" style={{ fontSize: '13px' }}><span className="text-[#64748B]">{v.country}</span></td>
                <td className="px-5 py-3.5" style={{ fontSize: '13px', fontWeight: 500 }}><span className="text-[#0F172A]">{v.spend}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#F1F5F9]">
          <span style={{ fontSize: '12px' }} className="text-[#94A3B8]">Showing 8 of 43 vendors · Create account to view full inventory</span>
        </div>
      </div>
    </div>
  );
}
