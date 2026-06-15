import type { AnalysisResult, EvidenceStatus, Severity } from './types';

export function getSovereigntyScore(analysisResult: AnalysisResult) {
  const { sovereigntyScores } = analysisResult;

  return Math.round(
    (sovereigntyScores.cloud +
      sovereigntyScores.data +
      sovereigntyScores.ai +
      sovereigntyScores.concentration +
      sovereigntyScores.regulatory) /
      5
  );
}

export function getEvidenceSummary(analysisResult: AnalysisResult) {
  const valid = analysisResult.evidence.filter((item) => item.status === 'Valid').length;
  const missing = analysisResult.evidence.filter((item) => item.status === 'Missing').length;
  const expiring = analysisResult.evidence.filter((item) => item.status === 'Expiring').length;

  return {
    valid,
    missing,
    expiring,
    coverage: analysisResult.evidence.length
      ? Math.round((valid / analysisResult.evidence.length) * 100)
      : 0,
  };
}

export function getGapSummary(analysisResult: AnalysisResult) {
  const findings = analysisResult.gaps;
  const highCount = findings.filter((finding) => finding.severity === 'High').length;
  const categories = Array.from(new Set(findings.map((finding) => finding.category)));

  return {
    findings,
    highCount,
    categories,
    total: findings.length,
  };
}

export function getVendorSummary(analysisResult: AnalysisResult) {
  const vendors = analysisResult.vendors;
  const criticalCount = vendors.filter((vendor) => vendor.criticality === 'Critical').length;
  const usCount = vendors.filter((vendor) => vendor.exposure === 'US' || vendor.country === 'US').length;
  const cloudCount = vendors.filter((vendor) => vendor.category === 'Cloud').length;

  return {
    vendors,
    criticalCount,
    usCount,
    cloudCount,
    totalVisible: vendors.length,
  };
}

export function getAuditSummary(analysisResult: AnalysisResult) {
  const totalPages = analysisResult.auditItems.reduce((sum, item) => sum + item.pages, 0);

  const readinessLevel =
    analysisResult.scenario.readinessScore >= 80
      ? 'Strong'
      : analysisResult.scenario.readinessScore >= 65
        ? 'Moderate'
        : 'Needs Work';

  return {
    totalPages,
    readinessLevel,
    isAuditReady: analysisResult.scenario.readinessScore >= 75,
  };
}

export function getConcentrationSummary(analysisResult: AnalysisResult) {
  return {
    topProvider: analysisResult.cloudRisk[0] ?? {
      label: 'Not assessed',
      pct: 0,
      spend: '—',
    },
    simulation: analysisResult.outageSimulation,
  };
}

export function getHighSeverityGaps(analysisResult: AnalysisResult) {
  return analysisResult.gaps.filter((gap) => gap.severity === 'High');
}

export function severityColor(
  severity: Severity,
  theme: {
    status: {
      error: string;
      warning: string;
      success: string;
    };
  }
) {
  if (severity === 'High') return theme.status.error;
  if (severity === 'Medium') return theme.status.warning;
  return theme.status.success;
}

export function evidenceStatusColor(
  status: EvidenceStatus | 'Covered' | 'Missing',
  theme: {
    status: {
      success: string;
      warning: string;
      error: string;
    };
  }
) {
  if (status === 'Valid' || status === 'Covered') return theme.status.success;
  if (status === 'Expiring') return theme.status.warning;
  return theme.status.error;
}
