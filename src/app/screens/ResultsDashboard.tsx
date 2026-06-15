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
import { theme } from '../../styles/theme';
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
    <div
      className={`flex h-full flex-col transition-all duration-500 ${
        mounted ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ backgroundColor: theme.neutral.background }}
    >
      <div
        className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3 sm:px-6"
        style={{
          backgroundColor: theme.neutral.surface,
          borderColor: theme.neutral.border,
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <CheckCircle2
            className="h-4 w-4 flex-shrink-0"
            style={{ color: theme.status.success }}
          />

          <div className="min-w-0">
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: theme.status.success,
              }}
              className="hidden truncate sm:block"
            >
              Analysis complete · {activeScenario.name}
            </span>

            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: theme.status.success,
              }}
              className="block truncate sm:hidden"
            >
              Analysis complete
            </span>

            <p
              style={{
                fontSize: '11px',
                color: theme.neutral.textMuted,
              }}
              className="hidden truncate md:block"
            >
              {activeScenario.headlineFinding}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalIntent('save')}
            className="rounded-lg border px-3 py-1.5 transition-colors"
            style={{
              fontSize: '12px',
              backgroundColor: theme.neutral.surface,
              borderColor: theme.neutral.border,
              color: theme.neutral.textSecondary,
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = theme.neutral.background;
              event.currentTarget.style.borderColor = theme.neutral.borderStrong;
              event.currentTarget.style.color = theme.neutral.text;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = theme.neutral.surface;
              event.currentTarget.style.borderColor = theme.neutral.border;
              event.currentTarget.style.color = theme.neutral.textSecondary;
            }}
          >
            Save results
          </button>

          <button
            type="button"
            onClick={() => setModalIntent('export')}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: theme.brand.primary,
              color: theme.sidebar.activeText,
              boxShadow: theme.shadow.brand,
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = theme.brand.primaryHover;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = theme.brand.primary;
            }}
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
