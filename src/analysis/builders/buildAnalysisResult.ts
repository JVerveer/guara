import { AnalysisResultSchema } from '../analysisResultSchema';
import type { AnalysisResult, ScenarioSummary, Vendor } from '../types';
import type { ParsedDocument } from '../ingestion/types';
import { detectEvidence } from '../detectors/evidenceDetector';
import { detectGaps } from '../detectors/gapDetector';
import { detectVendors } from '../detectors/vendorDetector';
import {
  buildCloudRisk,
  buildDependencies,
  buildOutageSimulation,
} from '../detectors/concentrationDetector';

function inferIndustry(documents: ParsedDocument[]) {
  const text = documents.map((doc) => `${doc.fileName} ${doc.text}`).join('\n').toLowerCase();

  if (text.includes('insurance') || text.includes('claims') || text.includes('policyholder')) {
    return 'Insurance';
  }

  if (text.includes('health') || text.includes('patient') || text.includes('clinical')) {
    return 'Healthcare SaaS';
  }

  if (text.includes('payment') || text.includes('stripe') || text.includes('settlement')) {
    return 'Payments';
  }

  return 'Uploaded Analysis';
}

function buildScenario(
  documents: ParsedDocument[],
  vendors: Vendor[],
  readinessScore: number,
  mainRisk: string,
  headlineFinding: string,
  regionExposure: string
): ScenarioSummary {
  const industry = inferIndustry(documents);

  return {
    id: `upload-${Date.now()}`,
    name:
      industry === 'Insurance'
        ? 'Uploaded Insurance Risk Package'
        : industry === 'Healthcare SaaS'
          ? 'Uploaded Healthcare SaaS Package'
          : industry === 'Payments'
            ? 'Uploaded Payments Risk Package'
            : 'Uploaded Vendor Package',
    industry,
    documents: documents.length,
    vendors: vendors.length,
    criticalVendors: vendors.filter((vendor) => vendor.criticality === 'Critical').length,
    readinessScore,
    mainRisk,
    headlineFinding,
    regionExposure,
  };
}

function calculateReadinessScore(args: {
  vendorCount: number;
  highFindingCount: number;
  evidenceCount: number;
  missingEvidenceCount: number;
}) {
  const base = 82;
  const highFindingPenalty = args.highFindingCount * 7;
  const missingEvidencePenalty = args.missingEvidenceCount * 5;
  const lowEvidencePenalty = args.evidenceCount < 4 ? 8 : 0;
  const vendorBonus = args.vendorCount > 0 ? 4 : 0;

  return Math.max(
    35,
    Math.min(94, base - highFindingPenalty - missingEvidencePenalty - lowEvidencePenalty + vendorBonus)
  );
}

function buildSovereigntyScores(args: {
  hasUsExposure: boolean;
  highFindingCount: number;
  cloudConcentration: number;
}) {
  return {
    cloud: Math.max(35, 85 - args.cloudConcentration),
    data: args.hasUsExposure ? 55 : 78,
    ai: args.highFindingCount > 2 ? 58 : 72,
    concentration: Math.max(30, 88 - args.cloudConcentration),
    regulatory: Math.max(45, 82 - args.highFindingCount * 6),
  };
}

function buildBoardRisks(mainRisk: string, findings: { title: string }[]) {
  return [
    mainRisk,
    ...findings.slice(0, 3).map((finding) => finding.title),
  ];
}

function buildAuditItems() {
  return [
    { label: 'Technology Dependency Map', pages: 8, type: 'Board Pack' },
    { label: 'Critical Supplier Register', pages: 6, type: 'Register' },
    { label: 'Gap & Risk Analysis Report', pages: 14, type: 'Risk Report' },
    { label: 'Evidence Inventory', pages: 7, type: 'Evidence' },
    { label: 'Concentration Risk Assessment', pages: 6, type: 'Risk Report' },
    { label: 'Remediation Action Plan', pages: 9, type: 'Action Plan' },
  ];
}

function buildRecommendations(findings: { rec: string }[]) {
  const recommendations = findings.map((finding) => finding.rec);

  return recommendations.length > 0
    ? Array.from(new Set(recommendations)).slice(0, 5)
    : [
        'Validate critical vendor inventory and confirm business owners.',
        'Collect current evidence for critical and important suppliers.',
        'Document exit and resilience testing for critical technology dependencies.',
      ];
}

export function buildAnalysisResultFromDocuments(
  documents: ParsedDocument[]
): AnalysisResult {
  const vendors = detectVendors(documents);
  const evidence = detectEvidence(documents);
  const gaps = detectGaps(documents, vendors);
  const cloudRisk = buildCloudRisk(vendors);
  const dependencies = buildDependencies(vendors);
  const outageSimulation = buildOutageSimulation(documents, vendors);

  const highFindingCount = gaps.filter((finding) => finding.severity === 'High').length;
  const missingEvidenceCount = evidence.filter((item) => item.status === 'Missing').length;
  const hasUsExposure = vendors.some((vendor) => vendor.exposure === 'US');
  const cloudConcentration = cloudRisk[0]?.pct ?? 0;

  const readinessScore = calculateReadinessScore({
    vendorCount: vendors.length,
    highFindingCount,
    evidenceCount: evidence.length,
    missingEvidenceCount,
  });

  const mainRisk =
    gaps[0]?.rec ??
    'Critical technology dependencies require validation and evidence collection.';

  const headlineFinding =
    gaps[0]?.title ??
    'Vendor dependency analysis completed.';

  const regionExposure = hasUsExposure
    ? 'US provider dependency detected'
    : 'No major non-EU exposure detected';

  const scenario = buildScenario(
    documents,
    vendors,
    readinessScore,
    mainRisk,
    headlineFinding,
    regionExposure
  );

  return AnalysisResultSchema.parse({
    source: 'upload',
    generatedAt: new Date().toISOString(),
    scenario,
    documents: documents.map((doc) => ({
      name: doc.fileName,
      size: `${(doc.size / 1024 / 1024).toFixed(2)} MB`,
      type: doc.extension.toUpperCase() || 'Document',
      icon:
        doc.extension === 'csv'
          ? '📊'
          : doc.extension === 'pdf'
            ? '📄'
            : doc.extension === 'docx'
              ? '📝'
              : '📎',
    })),
    vendors,
    gaps,
    evidence,
    cloudRisk,
    sovereigntyScores: buildSovereigntyScores({
      hasUsExposure,
      highFindingCount,
      cloudConcentration,
    }),
    dependencies,
    outageSimulation,
    boardRisks: buildBoardRisks(mainRisk, gaps),
    auditItems: buildAuditItems(),
    auditRecommendations: buildRecommendations(gaps),
  });
}
