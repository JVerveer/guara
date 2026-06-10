import { createContext, useContext, useState, useRef, type ReactNode } from 'react';
import { PROCESSING_STEPS } from '../data/constants';

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

interface AppContextValue {
  page: Page;
  navigate: (p: Page) => void;
  stepsDone: number;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  startSample: () => void;
  reset: () => void;
  hasResults: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>('home');
  const [stepsDone, setStepsDone] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasResults, setHasResults] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const navigate = (p: Page) => {
    setPage(p);
    setSidebarOpen(false);
  };

  const startSample = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setStepsDone(0);
    setPage('processing');
    setSidebarOpen(false);

    let cumulative = 0;
    PROCESSING_STEPS.forEach((step, i) => {
      cumulative += step.duration;
      const t = setTimeout(() => setStepsDone(i + 1), cumulative);
      timersRef.current.push(t);
    });

    const finalTimer = setTimeout(() => {
      setHasResults(true);
      setPage('overview');
    }, cumulative + 600);
    timersRef.current.push(finalTimer);
  };

  const reset = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setPage('home');
    setStepsDone(0);
    setHasResults(false);
    setSidebarOpen(false);
  };

  return (
    <AppContext.Provider value={{ page, navigate, stepsDone, sidebarOpen, setSidebarOpen, startSample, reset, hasResults }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
