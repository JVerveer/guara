import { useEffect, useState } from 'react';
import { CheckCircle2, Download } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { ConversionModal } from '../components/ui/ConversionModal';
import { OverviewTab } from '../components/tabs/OverviewTab';
import { VendorsTab } from '../components/tabs/VendorsTab';
import { GapsTab } from '../components/tabs/GapsTab';
import { EvidenceTab } from '../components/tabs/EvidenceTab';
import { ConcentrationTab } from '../components/tabs/ConcentrationTab';
import { AuditTab } from '../components/tabs/AuditTab';
import type { Page } from '../contexts/AppContext';

type ConversionIntent = 'save' | 'export' | 'upload';

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
  const [modalIntent, setModalIntent] = useState<ConversionIntent | null>(null);
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
            onClick={() => setModalIntent('save')}
            className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
            style={{ fontSize: '12px' }}
          >
            Save results
          </button>

          <button
            type="button"
            onClick={() => setModalIntent('export')}
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

      <ConversionModal
        open={modalIntent !== null}
        intent={modalIntent ?? 'save'}
        onClose={() => setModalIntent(null)}
      />
    </div>
  );
}
