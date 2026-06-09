import { AppProvider, useApp } from './contexts/AppContext';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { HeroUpload } from './screens/HeroUpload';
import { ProcessingScreen } from './screens/ProcessingScreen';
import { ResultsDashboard } from './screens/ResultsDashboard';
import { HowItWorks } from './sections/HowItWorks';
import { Security } from './sections/Security';
import { FAQ } from './sections/FAQ';

function AppShell() {
  const { appState } = useApp();

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <Nav />

      {appState === 'idle' && (
        <>
          <HeroUpload />
          <HowItWorks />
          <Security />
          <FAQ />
          <Footer />
        </>
      )}

      {appState === 'processing' && <ProcessingScreen />}

      {appState === 'results' && <ResultsDashboard />}
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
