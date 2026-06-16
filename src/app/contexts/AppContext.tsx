import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { PROCESSING_STEPS } from '../data/constants';
import {
  getSampleAnalysisResult,
  getSampleScenario,
  SAMPLE_SCENARIOS,
} from '../../analysis/sampleAnalysis';
import type { AnalysisResult, ScenarioSummary } from '../../analysis/types';

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
  | 'remediation'
  | 'audit';

export type ReportSectionKey =
  | 'overview'
  | 'vendors'
  | 'gaps'
  | 'evidence'
  | 'concentration'
  | 'remediation'
  | 'audit';

export type ReportSections = Record<ReportSectionKey, boolean>;

export const DEFAULT_REPORT_SECTIONS: ReportSections = {
  overview: true,
  vendors: true,
  gaps: true,
  evidence: true,
  concentration: true,
  remediation: true,
  audit: true,
};

interface AppContextValue {
  page: Page;
  navigate: (page: Page) => void;

  hasResults: boolean;
  stepsDone: number;

  activeScenario: ScenarioSummary;
  analysisResult: AnalysisResult;
  setAnalysisResult: (analysisResult: AnalysisResult) => void;

  reportSections: ReportSections;
  setReportSections: (sections: ReportSections) => void;
  toggleReportSection: (section: ReportSectionKey) => void;
  resetReportSections: () => void;

  startSample: (scenarioId?: string) => void;
  startUploadedAnalysis: (analysisResult: AnalysisResult) => void;
  reset: () => void;

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const initialScenario = SAMPLE_SCENARIOS[0];
  const initialAnalysisResult = getSampleAnalysisResult(initialScenario.id);

  const [page, setPage] = useState<Page>('home');
  const [hasResults, setHasResults] = useState(false);
  const [stepsDone, setStepsDone] = useState(0);
  const [activeScenario, setActiveScenario] =
    useState<ScenarioSummary>(initialScenario);
  const [analysisResult, setAnalysisResult] =
    useState<AnalysisResult>(initialAnalysisResult);
  const [reportSections, setReportSections] =
    useState<ReportSections>(DEFAULT_REPORT_SECTIONS);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    setSidebarOpen(false);
  };

  const toggleReportSection = (section: ReportSectionKey) => {
    setReportSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const resetReportSections = () => {
    setReportSections(DEFAULT_REPORT_SECTIONS);
  };

  const completeProcessing = (result: AnalysisResult) => {
    setAnalysisResult(result);
    setActiveScenario(result.scenario);
    setHasResults(true);
    setPage('overview');
  };

  const startSample = (scenarioId?: string) => {
    const scenario = getSampleScenario(scenarioId);
    const result = getSampleAnalysisResult(scenario.id);

    setActiveScenario(scenario);
    setAnalysisResult(result);
    setReportSections(DEFAULT_REPORT_SECTIONS);
    setStepsDone(0);
    setHasResults(false);
    setPage('processing');
    setSidebarOpen(false);

    let stepIndex = 0;

    const runStep = () => {
      const step = PROCESSING_STEPS[stepIndex];

      if (!step) {
        completeProcessing(result);
        return;
      }

      window.setTimeout(() => {
        stepIndex += 1;
        setStepsDone(stepIndex);
        runStep();
      }, step.duration);
    };

    runStep();
  };

  const startUploadedAnalysis = (result: AnalysisResult) => {
    setActiveScenario(result.scenario);
    setAnalysisResult(result);
    setReportSections(DEFAULT_REPORT_SECTIONS);
    setStepsDone(0);
    setHasResults(false);
    setPage('processing');
    setSidebarOpen(false);

    let stepIndex = 0;

    const runStep = () => {
      const step = PROCESSING_STEPS[stepIndex];

      if (!step) {
        completeProcessing(result);
        return;
      }

      window.setTimeout(() => {
        stepIndex += 1;
        setStepsDone(stepIndex);
        runStep();
      }, step.duration);
    };

    runStep();
  };

  const reset = () => {
    const scenario = SAMPLE_SCENARIOS[0];
    const result = getSampleAnalysisResult(scenario.id);

    setPage('home');
    setHasResults(false);
    setStepsDone(0);
    setActiveScenario(scenario);
    setAnalysisResult(result);
    setReportSections(DEFAULT_REPORT_SECTIONS);
    setSidebarOpen(false);
  };

  const value = useMemo<AppContextValue>(
    () => ({
      page,
      navigate,
      hasResults,
      stepsDone,
      activeScenario,
      analysisResult,
      setAnalysisResult,
      reportSections,
      setReportSections,
      toggleReportSection,
      resetReportSections,
      startSample,
      startUploadedAnalysis,
      reset,
      sidebarOpen,
      setSidebarOpen,
    }),
    [page, hasResults, stepsDone, activeScenario, analysisResult, reportSections, sidebarOpen]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }

  return context;
}
