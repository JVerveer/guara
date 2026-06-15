import { useApp } from '../app/contexts/AppContext';
import { getSampleAnalysisResult } from '../analysis/sampleAnalysis';
import type { AnalysisResult } from '../analysis/types';

export function useAnalysisResult() {
  const app = useApp() as ReturnType<typeof useApp> & {
    analysisResult?: AnalysisResult | null;
  };

  return app.analysisResult ?? getSampleAnalysisResult(app.activeScenario.id);
}
