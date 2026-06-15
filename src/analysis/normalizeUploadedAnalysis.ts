import type { AnalysisResult, ScenarioSummary } from './types';

export function createEmptyAnalysisResult(
  scenario: ScenarioSummary,
  uploadedFileNames: string[] = []
): AnalysisResult {
  return {
    source: 'upload',
    generatedAt: new Date().toISOString(),
    scenario: {
      ...scenario,
      documents: uploadedFileNames.length,
      vendors: 0,
      criticalVendors: 0,
      readinessScore: 0,
      headlineFinding: 'Analysis has not completed yet.',
      mainRisk: 'No risk findings have been generated yet.',
      regionExposure: 'Not assessed',
    },
    documents: uploadedFileNames.map((name) => ({
      name,
      type: name.split('.').pop()?.toUpperCase() ?? 'Document',
      icon: '📄',
    })),
    vendors: [],
    gaps: [],
    evidence: [],
    cloudRisk: [],
    sovereigntyScores: {
      cloud: 0,
      data: 0,
      ai: 0,
      concentration: 0,
      regulatory: 0,
    },
    dependencies: [],
    outageSimulation: {
      provider: 'Not assessed',
      affectedDependencies: 0,
      affectedServices: [],
      impact: 'Medium',
      recovery: 'Not assessed',
      recommendation: 'Complete document analysis before generating outage recommendations.',
    },
    boardRisks: [],
    auditItems: [],
    auditRecommendations: [],
  };
}

export function normalizeUploadedAnalysisResult(input: AnalysisResult): AnalysisResult {
  return {
    ...input,
    source: 'upload',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    documents: input.documents ?? [],
    vendors: input.vendors ?? [],
    gaps: input.gaps ?? [],
    evidence: input.evidence ?? [],
    cloudRisk: input.cloudRisk ?? [],
    dependencies: input.dependencies ?? [],
    boardRisks: input.boardRisks ?? [],
    auditItems: input.auditItems ?? [],
    auditRecommendations: input.auditRecommendations ?? [],
  };
}
