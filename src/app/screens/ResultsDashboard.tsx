import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Star } from 'lucide-react';
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
  const { page, activeScenario } = useApp();
  const [showSave, setShowSave] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);

    return () => clearTimeout(timer);
  }, []);

  const TabContent = TAB_CONTENT[page] ?? OverviewTab;

  return (
    <div className={`flex h-full flex-col transition-all duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />

          <div className="min-w-0">
            <span
              style={{ fontSize: '12px', fontWeight: 600 }}
              className="hidden truncate text-green-600 sm:block"
            >
              Analysis complete · {activeScenario.name}
            </span>

            <span
              style={{ fontSize: '12px', fontWeight: 600 }}
              className="block truncate text-green-600 sm:hidden"
            >
              Analysis complete
            </span>

            <p style={{ fontSize: '11px' }} className="hidden truncate text-[#94A3B8] md:block">
              {activeScenario.headlineFinding}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSave(true)}
            className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
            style={{ fontSize: '12px' }}
          >
            Save results
          </button>

          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-white transition-colors hover:bg-[#1D4ED8]"
            style={{ fontSize: '12px', fontWeight: 600 }}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <TabContent />
      </div>

      {showSave && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setShowSave(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Star className="mb-3 h-8 w-8 text-[#2563EB]" />

            <h3 style={{ fontSize: '18px', fontWeight: 700 }} className="mb-1 text-[#0F172A]">
              Save this analysis
            </h3>

            <p style={{ fontSize: '13px', lineHeight: 1.6 }} className="mb-4 text-[#64748B]">
              Create a free account to save the {activeScenario.name.toLowerCase()} sample results and upload your own
              vendor documents next.
            </p>

            <div className="mb-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p style={{ fontSize: '16px', fontWeight: 800 }} className="text-[#0F172A]">
                    {activeScenario.vendors}
                  </p>
                  <p style={{ fontSize: '10px', fontWeight: 500 }} className="text-[#64748B]">
                    Vendors
                  </p>
                </div>

                <div>
                  <p style={{ fontSize: '16px', fontWeight: 800 }} className="text-[#0F172A]">
                    {activeScenario.criticalVendors}
                  </p>
                  <p style={{ fontSize: '10px', fontWeight: 500 }} className="text-[#64748B]">
                    Critical
                  </p>
                </div>

                <div>
                  <p style={{ fontSize: '16px', fontWeight: 800 }} className="text-[#0F172A]">
                    {activeScenario.readinessScore}
                  </p>
                  <p style={{ fontSize: '10px', fontWeight: 500 }} className="text-[#64748B]">
                    Score
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <input
                type="email"
                placeholder="your@email.com"
                className="rounded-xl border border-[#E2E8F0] px-4 py-3 text-[#0F172A] outline-none focus:ring-2 focus:ring-[#2563EB]"
                style={{ fontSize: '14px' }}
              />

              <button
                type="button"
                className="rounded-xl bg-[#2563EB] py-3 text-white transition-colors hover:bg-[#1D4ED8]"
                style={{ fontSize: '14px', fontWeight: 600 }}
              >
                Create Free Account
              </button>

              <button
                type="button"
                onClick={() => setShowSave(false)}
                className="text-[#94A3B8] transition-colors hover:text-[#64748B]"
                style={{ fontSize: '13px' }}
              >
                Cancel
              </button>
            </div>

            <p style={{ fontSize: '11px' }} className="mt-3 text-center text-[#94A3B8]">
              Free to start. No credit card required.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
