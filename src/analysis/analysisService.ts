import {
  normalizeUploadedAnalysisResult,
  createEmptyAnalysisResult,
} from './normalizeUploadedAnalysis';
import type { AnalysisResult, ScenarioSummary } from './analysisResultSchema';

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
  // Your backend should return JSON matching AnalysisResultSchema.
  return createEmptyAnalysisResult(
    scenario,
    files.map((file) => file.name)
  );
}

export async function analyzeUploadedDocumentsViaApi(
  files: File[]
): Promise<AnalysisResult> {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch('/api/analyze', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to analyze uploaded documents.');
  }

  const data = await response.json();

  return normalizeUploadedAnalysisResult(data);
}
