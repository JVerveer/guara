import { Menu, LogIn } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { theme } from '../../styles/theme';

const PAGE_TITLES: Record<string, string> = {
  home: 'Guara',
  'how-it-works': 'How it works',
  security: 'Security',
  faq: 'FAQ',
  processing: 'Analysing…',
  overview: 'Overview',
  vendors: 'Vendor Inventory',
  gaps: 'DORA Gap Analysis',
  evidence: 'Evidence Library',
  concentration: 'Concentration Risk',
  audit: 'Audit Package',
};

export function TopBar() {
  const { page, setSidebarOpen } = useApp();

  return (
    <header
      className="h-14 flex items-center justify-between px-4 md:px-6 flex-shrink-0 border-b"
      style={{
        backgroundColor: theme.neutral.surface,
        borderColor: theme.neutral.border,
      }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden transition-colors p-1"
          style={{
            color: theme.neutral.textSecondary,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = theme.neutral.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color =
              theme.neutral.textSecondary;
          }}
        >
          <Menu className="w-5 h-5" />
        </button>

        <span
          style={{
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: theme.neutral.text,
          }}
        >
          {PAGE_TITLES[page] ?? 'Guara'}
        </span>
      </div>

      <button
        className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors"
        style={{
          fontSize: '13px',
          fontWeight: 600,
          backgroundColor: theme.neutral.surface,
          borderColor: theme.neutral.border,
          color: theme.neutral.textSecondary,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor =
            theme.neutral.background;
          e.currentTarget.style.borderColor =
            theme.neutral.borderStrong;
          e.currentTarget.style.color =
            theme.neutral.text;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor =
            theme.neutral.surface;
          e.currentTarget.style.borderColor =
            theme.neutral.border;
          e.currentTarget.style.color =
            theme.neutral.textSecondary;
        }}
      >
        <LogIn className="w-4 h-4" />
        <span className="hidden sm:inline">
          Sign In
        </span>
      </button>
    </header>
  );
}