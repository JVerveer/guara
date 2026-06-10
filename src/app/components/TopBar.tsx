import { Menu, LogIn } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

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
    <header className="h-14 border-b border-[#E2E8F0] bg-white flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      {/* Left: hamburger (mobile) + page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden text-[#64748B] hover:text-[#0F172A] transition-colors p-1"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span style={{ fontSize: '14px', fontWeight: 600 }} className="text-[#0F172A]">
          {PAGE_TITLES[page] ?? 'Guara'}
        </span>
      </div>

      {/* Right: Sign In */}
      <button className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-lg hover:bg-[#1D4ED8] transition-colors shadow-sm" style={{ fontSize: '13px', fontWeight: 600 }}>
        <LogIn className="w-4 h-4" />
        <span className="hidden sm:inline">Sign In</span>
      </button>
    </header>
  );
}
