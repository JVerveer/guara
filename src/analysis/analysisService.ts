import type { AnalysisResult } from './types';
import { analyzeUploadedPackage } from './analyzeUploadedPackage';
import { normalizeUploadedAnalysisResult } from './normalizeUploadedAnalysis';

export async function analyzeUploadedDocuments(files: File[]): Promise<AnalysisResult> {
  return analyzeUploadedPackage(files);
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
