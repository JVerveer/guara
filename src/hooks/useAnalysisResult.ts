import { useApp } from '../app/contexts/AppContext';

export function useAnalysisResult() {
  const { analysisResult } = useApp();

  return analysisResult;
}
