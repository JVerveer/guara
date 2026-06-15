import type { AnalysisResult, ScenarioSummary } from './types';
import { createEmptyAnalysisResult } from './normalizeUploadedAnalysis';

export async function analyzeUploadedDocuments(files: File[]): Promise<AnalysisResult> {
  const scenario: ScenarioSummary = {
    id: `upload-${Date.now()}`,
    name: 'Uploaded Vendor Package',
    industry: 'Uploaded Analysis',
    documents: files.length,
    vendors: 0,
    criticalVendors: 0,
    readinessScore: 0,
    mainRisk: 'Analysis has not completed yet.',
    headlineFinding: 'Uploaded documents received.',
    regionExposure: 'Not assessed',
  };

  // Replace this stub with your backend call later.
  // The backend should return an AnalysisResult.
  return createEmptyAnalysisResult(
    scenario,
    files.map((file) => file.name)
  );
}
