import { useState, useEffect } from 'react';
import { Download, Star, CheckCircle2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { OverviewTab } from '../components/tabs/OverviewTab';
import { VendorsTab } from '../components/tabs/VendorsTab';
import { GapsTab } from '../components/tabs/GapsTab';
import { EvidenceTab } from '../components/tabs/EvidenceTab';
import { ConcentrationTab } from '../components/tabs/ConcentrationTab';
import { AuditTab } from '../components/tabs/AuditTab';
import type { Page } from '../contexts/AppContext';

const TAB_CONTENT: Partial<Record<Page, React.ComponentType>> = {
  overview: OverviewTab,
  vendors: VendorsTab,
  gaps: GapsTab,
  evidence: EvidenceTab,
  concentration: ConcentrationTab,
  audit: AuditTab,
};

export function ResultsDashboard() {
  const { page } = useApp();
  const [showSave, setShowSave] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const TabContent = TAB_CONTENT[page] ?? OverviewTab;

  return (
    <div className={`flex flex-col h-full transition-all duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
      {/* Results sub-header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#E2E8F0] bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span style={{ fontSize: '12px', fontWeight: 500 }} className="text-green-600 hidden sm:inline">Analysis complete · Sample DORA Package</span>
          <span style={{ fontSize: '12px', fontWeight: 500 }} className="text-green-600 sm:hidden">Sample analysis</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSave(true)} className="text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0] rounded-lg px-3 py-1.5 hover:bg-[#F8FAFC] transition-colors" style={{ fontSize: '12px' }}>
            Save results
          </button>
          <button className="flex items-center gap-1.5 bg-[#2563EB] text-white rounded-lg px-3 py-1.5 hover:bg-[#1D4ED8] transition-colors" style={{ fontSize: '12px', fontWeight: 600 }}>
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Tab content — scrollable */}
      <div className="flex-1 overflow-y-auto">
        <TabContent />
      </div>

      {/* Save modal */}
      {showSave && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setShowSave(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Star className="w-8 h-8 text-[#2563EB] mb-3" />
            <h3 style={{ fontSize: '18px', fontWeight: 700 }} className="text-[#0F172A] mb-1">Save your results</h3>
            <p style={{ fontSize: '13px', lineHeight: 1.6 }} className="text-[#64748B] mb-4">Create a free account to save this analysis and upload your own documents.</p>
            <div className="flex flex-col gap-2.5">
              <input type="email" placeholder="your@email.com" className="border border-[#E2E8F0] rounded-xl px-4 py-3 text-[#0F172A] outline-none focus:ring-2 focus:ring-[#2563EB]" style={{ fontSize: '14px' }} />
              <button className="bg-[#2563EB] text-white py-3 rounded-xl hover:bg-[#1D4ED8] transition-colors" style={{ fontSize: '14px', fontWeight: 600 }}>
                Create Free Account
              </button>
              <button onClick={() => setShowSave(false)} className="text-[#94A3B8] hover:text-[#64748B] transition-colors" style={{ fontSize: '13px' }}>Cancel</button>
            </div>
            <p style={{ fontSize: '11px' }} className="text-[#94A3B8] text-center mt-3">Free to start. No credit card required.</p>
          </div>
        </div>
      )}
    </div>
  );
}
