import { AppProvider, useApp } from './contexts/AppContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { HeroUpload } from './screens/HeroUpload';
import { HowItWorksPage } from './screens/HowItWorksPage';
import { SecurityPage } from './screens/SecurityPage';
import { FAQPage } from './screens/FAQPage';
import { ProcessingScreen } from './screens/ProcessingScreen';
import { ResultsDashboard } from './screens/ResultsDashboard';

const RESULT_PAGES = [
  'overview',
  'vendors',
  'gaps',
  'evidence',
  'concentration',
  'remediation',
  'audit',
];

function AppShell() {
  const { page } = useApp();

  const isResultPage = RESULT_PAGES.includes(page);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />

        {/* Content panel — fills remaining height, no outer scroll */}
        <main className="flex-1 overflow-hidden relative">
          {page === 'home' && <HeroUpload />}
          {page === 'how-it-works' && <HowItWorksPage />}
          {page === 'security' && <SecurityPage />}
          {page === 'faq' && <FAQPage />}
          {page === 'processing' && <ProcessingScreen />}
          {isResultPage && <ResultsDashboard />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
