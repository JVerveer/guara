import { createContext, useContext, useState, useRef, type ReactNode } from 'react';
import { type AppState, PROCESSING_STEPS } from '../data/constants';

interface AppContextValue {
  appState: AppState;
  stepsDone: number;
  startSample: () => void;
  reset: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [appState, setAppState] = useState<AppState>('idle');
  const [stepsDone, setStepsDone] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const startSample = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    setAppState('processing');
    setStepsDone(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    let cumulative = 0;
    PROCESSING_STEPS.forEach((step, i) => {
      cumulative += step.duration;
      const t = setTimeout(() => setStepsDone(i + 1), cumulative);
      timersRef.current.push(t);
    });

    const total = cumulative + 600;
    const finalTimer = setTimeout(() => {
      setAppState('results');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, total);
    timersRef.current.push(finalTimer);
  };

  const reset = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setAppState('idle');
    setStepsDone(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AppContext.Provider value={{ appState, stepsDone, startSample, reset }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
