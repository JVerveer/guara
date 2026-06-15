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
import { theme } from '../../styles/theme';

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

export function Sidebar() {
  const {
    page,
    navigate,
    hasResults,
    reset,
    sidebarOpen,
    setSidebarOpen,
  } = useApp();

  const getItemStyle = (id: Page): React.CSSProperties => {
    const active = page === id;

    return {
      fontSize: '14px',
      color: active
        ? theme.sidebar.activeText
        : theme.sidebar.textMuted,
      backgroundColor: active
        ? theme.sidebar.activeBackground
        : 'transparent',
    };
  };

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50 flex h-full w-[240px] flex-col
          transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:static md:z-auto md:translate-x-0
        `}
        style={{
          backgroundColor: theme.sidebar.background,
        }}
      >
        <div
          className="flex h-16 flex-shrink-0 items-center justify-between px-5"
          style={{
            borderBottom: `1px solid ${theme.sidebar.border}`,
          }}
        >
          <button
            onClick={() => navigate('home')}
            className="flex items-center"
          >
            <GuaraLogo />
          </button>

          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden transition-colors"
            style={{
              color: theme.sidebar.textMuted,
            }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-6">
            <p
              className="mb-2 px-3 uppercase"
              style={{
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: theme.sidebar.textMuted,
              }}
            >
              Menu
            </p>

            {LANDING_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => navigate(id)}
                className="mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200"
                style={getItemStyle(id)}
                onMouseEnter={(e) => {
                  if (page !== id) {
                    e.currentTarget.style.backgroundColor =
                      theme.sidebar.hoverBackground;
                    e.currentTarget.style.color =
                      theme.sidebar.hoverText;
                  }
                }}
                onMouseLeave={(e) => {
                  if (page !== id) {
                    e.currentTarget.style.backgroundColor =
                      'transparent';
                    e.currentTarget.style.color =
                      theme.sidebar.textMuted;
                  }
                }}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>

          {hasResults && (
            <div>
              <p
                className="mb-2 px-3 uppercase"
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: theme.sidebar.textMuted,
                }}
              >
                Sample Analysis
              </p>

              {RESULTS_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  className="mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200"
                  style={getItemStyle(id)}
                  onMouseEnter={(e) => {
                    if (page !== id) {
                      e.currentTarget.style.backgroundColor =
                        theme.sidebar.hoverBackground;
                      e.currentTarget.style.color =
                        theme.sidebar.hoverText;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (page !== id) {
                      e.currentTarget.style.backgroundColor =
                        'transparent';
                      e.currentTarget.style.color =
                        theme.sidebar.textMuted;
                    }
                  }}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </nav>

        <div
          className="flex-shrink-0 space-y-2 px-3 py-4"
          style={{
            borderTop: `1px solid ${theme.sidebar.border}`,
          }}
        >
          {hasResults && (
            <button
              onClick={reset}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 transition-all duration-200"
              style={{
                fontSize: '13px',
                color: theme.sidebar.textMuted,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.sidebar.hoverBackground;
                e.currentTarget.style.color =
                  theme.sidebar.hoverText;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  'transparent';
                e.currentTarget.style.color =
                  theme.sidebar.textMuted;
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Start over
            </button>
          )}

          <div className="px-3 py-2">
            <p
              style={{
                fontSize: '11px',
                color: theme.sidebar.textMuted,
              }}
            >
              © 2026 Guara
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}