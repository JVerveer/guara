import {
  Home,
  Info,
  Shield,
  HelpCircle,
  Building2,
  AlertTriangle,
  FileText,
  TrendingUp,
  Package,
  LayoutDashboard,
  RotateCcw,
  X,
} from 'lucide-react';
import { useApp, type Page } from '../contexts/AppContext';
import { GuaraLogo } from '../components/ui/GuaraLogo';

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
  { id: 'vendors', label: 'Vendor Intelligence', icon: Building2 },
  { id: 'gaps', label: 'Findings', icon: AlertTriangle },
  { id: 'evidence', label: 'Evidence Coverage', icon: FileText },
  { id: 'concentration', label: 'Dependencies', icon: TrendingUp },
  { id: 'audit', label: 'Board Package', icon: Package },
];

const RESULTS_PAGES: Page[] = ['overview', 'vendors', 'gaps', 'evidence', 'concentration', 'audit'];

export function Sidebar() {
  const { page, navigate, hasResults, reset, sidebarOpen, setSidebarOpen } = useApp();
  const inResults = RESULTS_PAGES.includes(page);
  const navItems = (inResults || hasResults) && RESULTS_PAGES.includes(page) ? RESULTS_ITEMS : LANDING_ITEMS;

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-full w-[240px] flex-col bg-[#0F172A]
          transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:static md:z-auto md:translate-x-0
        `}
      >
        <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-white/10 px-5">
          <button onClick={() => navigate('home')} className="flex items-center">
            <GuaraLogo />
          </button>

          <button
            onClick={() => setSidebarOpen(false)}
            className="text-slate-400 transition-colors hover:text-white md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-6">
            <p
              style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em' }}
              className="mb-2 px-3 uppercase text-slate-500"
            >
              Menu
            </p>

            {LANDING_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => navigate(id)}
                className={`mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  page === id
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
                style={{ fontSize: '14px' }}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>

          {hasResults && (
            <div>
              <p
                style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em' }}
                className="mb-2 px-3 uppercase text-slate-500"
              >
                Sample Analysis
              </p>

              {RESULTS_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  className={`mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    page === id
                      ? 'bg-[#2563EB]/20 text-[#60A5FA]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                  style={{ fontSize: '14px' }}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </nav>

        <div className="flex-shrink-0 space-y-2 border-t border-white/10 px-3 py-4">
          {hasResults && (
            <button
              onClick={reset}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
              style={{ fontSize: '13px' }}
            >
              <RotateCcw className="h-4 w-4" />
              Start over
            </button>
          )}

          <div className="px-3 py-2">
            <p style={{ fontSize: '11px' }} className="text-slate-600">
              © 2026 Guara
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
