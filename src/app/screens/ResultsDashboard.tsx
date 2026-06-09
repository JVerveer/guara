import { useState, useEffect } from 'react';
import { Download, RefreshCw, Star, CheckCircle2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { OverviewTab } from '../components/tabs/OverviewTab';
import { VendorsTab } from '../components/tabs/VendorsTab';
import { GapsTab } from '../components/tabs/GapsTab';
import { EvidenceTab } from '../components/tabs/EvidenceTab';
import { ConcentrationTab } from '../components/tabs/ConcentrationTab';
import { AuditTab } from '../components/tabs/AuditTab';

type TabId = 'overview' | 'vendors' | 'gaps' | 'evidence' | 'concentration' | 'audit';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'vendors', label: 'Vendor Inventory' },
  { id: 'gaps', label: 'DORA Gaps' },
  { id: 'evidence', label: 'Evidence Library' },
  { id: 'concentration', label: 'Concentration Risk' },
  { id: 'audit', label: 'Audit Package' },
];

export function ResultsDashboard() {
  const { reset } = useApp();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`min-h-screen transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      {/* Sticky dashboard header */}
      <div className="pt-20 bg-white border-b border-[#E2E8F0] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between py-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span style={{ fontSize: '12px', fontWeight: 500 }} className="text-green-600">
                  Analysis complete · Sample DORA Package
                </span>
              </div>
              <h1 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em' }} className="text-[#0F172A]">
                Vendor Risk Programme
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={reset}
                className="flex items-center gap-1.5 text-[#64748B] hover:text-[#0F172A] transition-colors border border-[#E2E8F0] rounded-lg px-3 py-2 bg-white hover:bg-[#F8FAFC]"
                style={{ fontSize: '13px' }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try your own
              </button>
              <button
                className="flex items-center gap-1.5 bg-[#2563EB] text-white rounded-lg px-4 py-2 hover:bg-[#1D4ED8] transition-colors shadow-sm"
                style={{ fontSize: '13px', fontWeight: 600 }}
              >
                <Download className="w-3.5 h-3.5" />
                Export Audit Package
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 overflow-x-auto pb-px">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2.5 whitespace-nowrap transition-all border-b-2 -mb-px ${activeTab === t.id ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'}`}
                style={{ fontSize: '13px', fontWeight: activeTab === t.id ? 600 : 400 }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'vendors' && <VendorsTab />}
        {activeTab === 'gaps' && <GapsTab />}
        {activeTab === 'evidence' && <EvidenceTab />}
        {activeTab === 'concentration' && <ConcentrationTab />}
        {activeTab === 'audit' && <AuditTab />}
      </div>

      {/* Save / signup CTA */}
      <div className="border-t border-[#E2E8F0] bg-[#EFF6FF] py-10 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <Star className="w-8 h-8 text-[#2563EB] mx-auto mb-3" />
          <h3 style={{ fontSize: '22px', fontWeight: 700 }} className="text-[#0F172A] mb-2">
            Save your results & upload your own documents
          </h3>
          <p style={{ fontSize: '15px' }} className="text-[#64748B] mb-6">
            Create a free account to save this analysis, upload your real documents, and monitor vendor risk continuously.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 max-w-xs border border-[#BFDBFE] rounded-xl px-4 py-3 bg-white text-[#0F172A] outline-none focus:ring-2 focus:ring-[#2563EB]"
              style={{ fontSize: '14px' }}
            />
            <button
              className="bg-[#2563EB] text-white px-7 py-3 rounded-xl hover:bg-[#1D4ED8] transition-colors shadow-md shadow-blue-200"
              style={{ fontSize: '15px', fontWeight: 600 }}
            >
              Create Free Account
            </button>
          </div>
          <p style={{ fontSize: '12px' }} className="text-[#94A3B8] mt-3">Free to start. No credit card required.</p>
        </div>
      </div>
    </div>
  );
}
