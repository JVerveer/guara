import type { AnalysisResult, FindingTrace } from '../analysis/types';

function traceCount(items: Array<{ trace?: FindingTrace[] }>) {
  return items.reduce((sum, item) => sum + (item.trace?.length ?? 0), 0);
}

function topTrace(trace?: FindingTrace[]) {
  return trace?.[0];
}

export function buildRiskReportData(analysisResult: AnalysisResult) {
  const evidenceValid = analysisResult.evidence.filter((item) => item.status === 'Valid').length;
  const evidenceMissing = analysisResult.evidence.filter((item) => item.status === 'Missing').length;
  const evidenceExpiring = analysisResult.evidence.filter((item) => item.status === 'Expiring').length;

  const evidenceCoverage =
    analysisResult.evidence.length > 0
      ? Math.round((evidenceValid / analysisResult.evidence.length) * 100)
      : 0;

  const sovereigntyScore = Math.round(
    (analysisResult.sovereigntyScores.cloud +
      analysisResult.sovereigntyScores.data +
      analysisResult.sovereigntyScores.ai +
      analysisResult.sovereigntyScores.concentration +
      analysisResult.sovereigntyScores.regulatory) /
      5
  );

  const totalAuditPages = analysisResult.auditItems.reduce((sum, item) => sum + item.pages, 0);

  const tracedFindings = analysisResult.gaps.filter((finding) => (finding.trace?.length ?? 0) > 0);
  const tracedVendors = analysisResult.vendors.filter((vendor) => (vendor.trace?.length ?? 0) > 0);
  const tracedEvidence = analysisResult.evidence.filter((item) => (item.trace?.length ?? 0) > 0);

  return {
    generatedAt: analysisResult.generatedAt,
    source: analysisResult.source,
    scenario: analysisResult.scenario,
    documents: analysisResult.documents,

    traceability: {
      findingsWithTrace: tracedFindings.length,
      vendorsWithTrace: tracedVendors.length,
      evidenceWithTrace: tracedEvidence.length,
      totalFindingTraces: traceCount(analysisResult.gaps),
      totalVendorTraces: traceCount(analysisResult.vendors),
      totalEvidenceTraces: traceCount(analysisResult.evidence),
    },

    overview: {
      sovereigntyScore,
      sovereigntyScores: analysisResult.sovereigntyScores,
      highGaps: analysisResult.gaps.filter((gap) => gap.severity === 'High'),
      dependencies: analysisResult.dependencies,
      boardRisks: analysisResult.boardRisks,
    },

    vendors: {
      all: analysisResult.vendors,
      criticalCount: analysisResult.vendors.filter((vendor) => vendor.criticality === 'Critical').length,
      traced: tracedVendors,
    },

    gaps: {
      findings: analysisResult.gaps,
      highCount: analysisResult.gaps.filter((finding) => finding.severity === 'High').length,
      categories: Array.from(new Set(analysisResult.gaps.map((finding) => finding.category))),
      traced: tracedFindings,
      evidenceBackedFindings: analysisResult.gaps.map((finding) => ({
        ...finding,
        primaryTrace: topTrace(finding.trace),
      })),
    },

    evidence: {
      items: analysisResult.evidence,
      valid: evidenceValid,
      missing: evidenceMissing,
      expiring: evidenceExpiring,
      coverage: evidenceCoverage,
      traced: tracedEvidence,
    },

    concentration: {
      cloudRisk: analysisResult.cloudRisk,
      simulation: analysisResult.outageSimulation,
      topProvider: analysisResult.cloudRisk[0] ?? {
        label: 'Not assessed',
        pct: 0,
        spend: '—',
      },
    },

    audit: {
      items: analysisResult.auditItems,
      totalPages: totalAuditPages,
      recommendations: analysisResult.auditRecommendations,
    },
  };
}

export type RiskReportData = ReturnType<typeof buildRiskReportData>;