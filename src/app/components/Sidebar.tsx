import {
  Zap, Home, Info, Shield, HelpCircle,
  Building2, AlertTriangle, FileText, TrendingUp, Package,
  LayoutDashboard, RotateCcw, X,
} from 'lucide-react';
import { useApp, type Page } from '../contexts/AppContext';

interface NavItem {
  id: Page;
  label: string;
  icon: React.ElementType;
}

const LANDING_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'how-it-works', label: 'How it works', icon: Info },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
];

const RESULTS_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'vendors', label: 'Vendor Inventory', icon: Building2 },
  { id: 'gaps', label: 'DORA Gaps', icon: AlertTriangle },
  { id: 'evidence', label: 'Evidence Library', icon: FileText },
  { id: 'concentration', label: 'Concentration Risk', icon: TrendingUp },
  { id: 'audit', label: 'Audit Package', icon: Package },
];

const RESULTS_PAGES: Page[] = ['overview', 'vendors', 'gaps', 'evidence', 'concentration', 'audit'];

export function Sidebar() {
  const { page, navigate, hasResults, reset, sidebarOpen, setSidebarOpen } = useApp();
  const inResults = RESULTS_PAGES.includes(page);
  const navItems = (inResults || hasResults) && RESULTS_PAGES.includes(page) ? RESULTS_ITEMS : LANDING_ITEMS;

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside className={`
        fixed top-0 left-0 h-full w-[240px] bg-[#0F172A] flex flex-col z-50
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:z-auto
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-white/10 flex-shrink-0">
          <button onClick={() => navigate('home')} className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#2563EB] rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span style={{ fontSize: '16px', fontWeight: 600 }} className="text-white tracking-tight">guara</span>
          </button>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {/* Landing nav */}
          <div className="mb-6">
            <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em' }} className="text-slate-500 uppercase px-3 mb-2">Menu</p>
            {LANDING_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => navigate(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-left transition-colors ${page === id ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                style={{ fontSize: '14px' }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>

          {/* Results nav — shown when results exist */}
          {hasResults && (
            <div>
              <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em' }} className="text-slate-500 uppercase px-3 mb-2">Sample Analysis</p>
              {RESULTS_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-left transition-colors ${page === id ? 'bg-[#2563EB]/20 text-[#60A5FA]' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                  style={{ fontSize: '14px' }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-white/10 flex-shrink-0 space-y-2">
          {hasResults && (
            <button
              onClick={reset}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
              style={{ fontSize: '13px' }}
            >
              <RotateCcw className="w-4 h-4" />
              Start over
            </button>
          )}
          <div className="px-3 py-2">
            <p style={{ fontSize: '11px' }} className="text-slate-600">© 2026 Guara</p>
          </div>
        </div>
      </aside>
    </>
  );
}
