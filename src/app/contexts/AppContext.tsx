import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { PROCESSING_STEPS, SAMPLE_SCENARIOS } from '../data/constants';

export type Page =
  | 'home'
  | 'how-it-works'
  | 'security'
  | 'faq'
  | 'processing'
  | 'overview'
  | 'vendors'
  | 'gaps'
  | 'evidence'
  | 'concentration'
  | 'audit';

export type SampleScenario = (typeof SAMPLE_SCENARIOS)[number];

interface AppContextValue {
  page: Page;
  navigate: (p: Page) => void;
  stepsDone: number;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  startSample: () => void;
  reset: () => void;
  hasResults: boolean;
  activeScenario: SampleScenario;
}

const AppContext = createContext<AppContextValue | null>(null);

function getRandomScenario(currentScenario?: SampleScenario) {
  if (SAMPLE_SCENARIOS.length === 1) {
    return SAMPLE_SCENARIOS[0];
  }

  const availableScenarios = SAMPLE_SCENARIOS.filter(
    (scenario) => scenario.id !== currentScenario?.id,
  );

  return availableScenarios[Math.floor(Math.random() * availableScenarios.length)];
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>('home');
  const [stepsDone, setStepsDone] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const [activeScenario, setActiveScenario] = useState<SampleScenario>(SAMPLE_SCENARIOS[0]);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const navigate = (p: Page) => {
    setPage(p);
    setSidebarOpen(false);
  };

  const startSample = () => {
    clearTimers();

    const scenario = getRandomScenario(activeScenario);

    setActiveScenario(scenario);
    setStepsDone(0);
    setHasResults(false);
    setPage('processing');
    setSidebarOpen(false);

    let cumulative = 0;

    PROCESSING_STEPS.forEach((step, index) => {
      cumulative += step.duration;

      const timer = setTimeout(() => {
        setStepsDone(index + 1);
      }, cumulative);

      timersRef.current.push(timer);
    });

    const finalTimer = setTimeout(() => {
      setHasResults(true);
      setPage('overview');
    }, cumulative + 600);

    timersRef.current.push(finalTimer);
  };

  const reset = () => {
    clearTimers();
    setPage('home');
    setStepsDone(0);
    setHasResults(false);
    setSidebarOpen(false);
  };

  return (
    <AppContext.Provider
      value={{
        page,
        navigate,
        stepsDone,
        sidebarOpen,
        setSidebarOpen,
        startSample,
        reset,
        hasResults,
        activeScenario,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);

  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }

  return ctx;
}
