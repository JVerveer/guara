import type { AnalysisResult } from './types';
import { analyzeUploadedPackage } from './analyzeUploadedPackage';
import { normalizeUploadedAnalysisResult } from './normalizeUploadedAnalysis';

const USE_SERVER_ANALYSIS = true;

export async function analyzeUploadedDocuments(files: File[]): Promise<AnalysisResult> {
  if (USE_SERVER_ANALYSIS) {
    return analyzeUploadedDocumentsViaApi(files);
  }

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

  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    const text = await response.text();

    throw new Error(
      `Expected JSON from /api/analyze but received ${response.status}: ${text.slice(0, 300)}`
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : 'Failed to analyze uploaded documents.'
    );
  }

  return normalizeUploadedAnalysisResult(data);
}
