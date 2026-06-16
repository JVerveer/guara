import { AnalysisResultSchema } from '../analysisResultSchema';
import type {
  AnalysisResult,
  EvidenceItem,
  Finding,
  ScenarioSummary,
  Vendor,
} from '../types';
import type { ParsedDocument } from '../ingestion/types';

import { detectEvidence as detectEvidenceItems } from '../detectors/evidenceDetector';
import { detectGaps } from '../detectors/gapDetector';
import { detectGapsFromFacts } from '../detectors/gapDetectorWithFacts';
import { detectVendors } from '../detectors/vendorDetector';
import {
  buildCloudRisk,
  buildDependencies,
  buildOutageSimulation,
} from '../detectors/concentrationDetector';

import { classifyDocuments } from '../intelligence/classifyDocuments';
import { detectEvidence as detectEvidenceCoverage } from '../intelligence/detectEvidence';
import { detectRisks } from '../intelligence/detectRisks';
import { extractVendors as extractVendorDetections } from '../intelligence/extractVendors';

import { buildFacts } from '../facts/buildFacts';

import type {
  ClassifiedDocument,
  EvidenceCoverage,
  RiskFinding,
  VendorDetection,
} from '../intelligence/types';

function inferIndustry(documents: ParsedDocument[]) {
  const text = documents
    .map((doc) => `${doc.fileName} ${doc.text}`)
    .join('\n')
    .toLowerCase();

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
    Math.min(
      94,
      base - highFindingPenalty - missingEvidencePenalty - lowEvidencePenalty + vendorBonus
    )
  );
}

function buildSovereigntyScores(args: {
  hasUsExposure: boolean;
  highFindingCount: number;
  cloudConcentration: number;
  hasAiExposure: boolean;
}) {
  return {
    cloud: Math.max(35, 85 - args.cloudConcentration),
    data: args.hasUsExposure ? 55 : 78,
    ai: args.hasAiExposure ? Math.max(42, 70 - args.highFindingCount * 4) : 82,
    concentration: Math.max(30, 88 - args.cloudConcentration),
    regulatory: Math.max(45, 82 - args.highFindingCount * 6),
  };
}

function buildBoardRisks(mainRisk: string, findings: { title: string }[]) {
  return [mainRisk, ...findings.slice(0, 3).map((finding) => finding.title)];
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

function normalizeVendorName(name: string) {
  const value = name.toLowerCase();

  if (value === 'amazon web services') return 'AWS';
  if (value === 'azure') return 'Microsoft Azure';
  if (value === 'google cloud') return 'Google Cloud Platform';

  return name;
}

function vendorCategoryFromName(name: string): Vendor['category'] {
  const value = name.toLowerCase();

  if (
    value.includes('aws') ||
    value.includes('azure') ||
    value.includes('google cloud') ||
    value.includes('gcp')
  ) {
    return 'Cloud';
  }

  if (value.includes('stripe')) return 'Payments';
  if (value.includes('okta') || value.includes('auth0')) return 'Identity';
  if (value.includes('snowflake') || value.includes('mongodb')) return 'Data';
  if (value.includes('openai')) return 'AI';
  if (value.includes('datadog')) return 'Monitoring';

  return 'SaaS';
}

function buildVendorFromDetection(detection: VendorDetection): Vendor {
  const name = normalizeVendorName(detection.name);
  const category = vendorCategoryFromName(name);
  const isCritical =
    category === 'Cloud' ||
    category === 'Payments' ||
    category === 'Identity' ||
    detection.occurrences >= 4;

  return {
    name,
    service:
      category === 'Cloud'
        ? 'Cloud Infrastructure'
        : category === 'Payments'
          ? 'Payment Processing'
          : category === 'Identity'
            ? 'Identity & Access'
            : category === 'AI'
              ? 'AI Services'
              : category === 'Data'
                ? 'Data Platform'
                : 'Technology Service',
    criticality: isCritical ? 'Critical' : 'Important',
    risk: category === 'Cloud' || category === 'AI' ? 'Medium' : 'Low',
    score: category === 'Cloud' || category === 'AI' ? 74 : 86,
    country: 'Unknown',
    spend: 'Unknown',
    category,
    exposure:
      category === 'Cloud' ||
      category === 'AI' ||
      name.toLowerCase().includes('stripe') ||
      name.toLowerCase().includes('snowflake')
        ? 'US'
        : 'Global',
    dependency: isCritical ? 'Critical' : 'High',
    dataType:
      category === 'AI'
        ? 'Prompt and contextual data'
        : category === 'Cloud'
          ? 'Application and infrastructure data'
          : category === 'Payments'
            ? 'Payment data'
            : category === 'Identity'
              ? 'Identity data'
              : 'Business data',
  };
}

function mergeVendors(baseVendors: Vendor[], vendorDetections: VendorDetection[]): Vendor[] {
  const vendorsByName = new Map<string, Vendor>();

  baseVendors.forEach((vendor) => {
    vendorsByName.set(normalizeVendorName(vendor.name).toLowerCase(), vendor);
  });

  vendorDetections.forEach((detection) => {
    const normalizedName = normalizeVendorName(detection.name);
    const key = normalizedName.toLowerCase();

    if (!vendorsByName.has(key)) {
      vendorsByName.set(key, buildVendorFromDetection(detection));
    }
  });

  return Array.from(vendorsByName.values());
}

function mapRiskFindingToGap(risk: RiskFinding): Finding {
  return {
    title: risk.title,
    severity: risk.severity,
    category: risk.category,
    vendor: 'Multiple providers',
    article:
      risk.category === 'DORA'
        ? 'DORA'
        : risk.category === 'AI Act'
          ? 'AI Inventory'
          : risk.category === 'Digital Sovereignty'
            ? 'Concentration'
            : risk.category === 'Data Residency'
              ? 'Residency'
              : 'Resilience',
    rec: risk.recommendation,
    trace: [],
  };
}

function hasTrace(finding: Finding) {
  return Boolean(finding.trace && finding.trace.length > 0);
}

function mergeFindings(baseFindings: Finding[], intelligenceRisks: RiskFinding[]): Finding[] {
  const findingsByKey = new Map<string, Finding>();

  const addOrUpgrade = (finding: Finding) => {
    const key = `${finding.title}-${finding.vendor}-${finding.category}`;
    const existing = findingsByKey.get(key);

    if (!existing) {
      findingsByKey.set(key, finding);
      return;
    }

    if (!hasTrace(existing) && hasTrace(finding)) {
      findingsByKey.set(key, finding);
    }
  };

  baseFindings.forEach(addOrUpgrade);

  intelligenceRisks.forEach((risk) => {
    addOrUpgrade(mapRiskFindingToGap(risk));
  });

  return Array.from(findingsByKey.values());
}

function evidenceItemFromClassifiedDocument(
  document: ClassifiedDocument,
  sourceDocument?: ParsedDocument
): EvidenceItem | null {
  if (document.documentType === 'Unknown') {
    return null;
  }

  const typeLabelByDocumentType: Record<ClassifiedDocument['documentType'], string> = {
    Contract: 'Contract',
    SOC2: 'SOC Report',
    ISO27001: 'Certificate',
    Questionnaire: 'Questionnaire',
    DPA: 'DPA',
    Policy: 'Policy',
    Register: 'Register',
    BCP: 'Business Continuity',
    ExitPlan: 'Exit Strategy',
    Unknown: 'Document',
  };

  return {
    name: document.fileName,
    vendor: 'Multiple / Unknown',
    type: typeLabelByDocumentType[document.documentType],
    status:
      sourceDocument?.text.toLowerCase().includes('missing') ||
      sourceDocument?.text.toLowerCase().includes('unsigned') ||
      sourceDocument?.text.toLowerCase().includes('not documented')
        ? 'Missing'
        : 'Valid',
    expires: 'Review required',
  };
}

function addMissingEvidenceItems(
  evidence: EvidenceItem[],
  coverage: EvidenceCoverage
): EvidenceItem[] {
  const items = [...evidence];

  const expectedEvidence: Array<{
    key: keyof EvidenceCoverage;
    name: string;
    type: string;
  }> = [
    { key: 'contracts', name: 'Vendor contracts', type: 'Contract' },
    { key: 'soc2', name: 'SOC 2 reports', type: 'SOC Report' },
    { key: 'iso27001', name: 'ISO 27001 certificates', type: 'Certificate' },
    { key: 'bcp', name: 'Business continuity plan', type: 'Business Continuity' },
    { key: 'exitPlan', name: 'Exit strategy documentation', type: 'Exit Strategy' },
    { key: 'dpa', name: 'Data processing agreements', type: 'DPA' },
  ];

  expectedEvidence.forEach((expected) => {
    if (!coverage[expected.key]) {
      const alreadyExists = items.some((item) => item.type === expected.type);

      if (!alreadyExists) {
        items.push({
          name: expected.name,
          vendor: 'Multiple / Unknown',
          type: expected.type,
          status: 'Missing',
          expires: '—',
        });
      }
    }
  });

  return items;
}

function mergeEvidence(
  baseEvidence: EvidenceItem[],
  classifiedDocuments: ClassifiedDocument[],
  documents: ParsedDocument[],
  coverage: EvidenceCoverage
): EvidenceItem[] {
  const evidenceByName = new Map<string, EvidenceItem>();

  baseEvidence.forEach((item) => {
    evidenceByName.set(`${item.name}-${item.type}`, item);
  });

  classifiedDocuments.forEach((document) => {
    const sourceDocument = documents.find((doc) => doc.fileName === document.fileName);
    const item = evidenceItemFromClassifiedDocument(document, sourceDocument);

    if (item) {
      evidenceByName.set(`${item.name}-${item.type}`, item);
    }
  });

  return addMissingEvidenceItems(Array.from(evidenceByName.values()), coverage);
}

function getDocumentIcon(extension: string) {
  if (extension === 'csv' || extension === 'xlsx' || extension === 'xls') return '📊';
  if (extension === 'pdf') return '📄';
  if (extension === 'docx') return '📝';
  if (extension === 'zip') return '🗂️';

  return '📎';
}

export function buildAnalysisResultFromDocuments(documents: ParsedDocument[]): AnalysisResult {
  const facts = buildFacts(documents);
  console.log('facts', facts); //tbd

  const classifiedDocuments = classifyDocuments(documents);
  const vendorDetections = extractVendorDetections(documents);
  const evidenceCoverage = detectEvidenceCoverage(classifiedDocuments);
  const intelligenceRisks = detectRisks(vendorDetections, evidenceCoverage);

  const detectedVendors = detectVendors(documents);
  const vendors = mergeVendors(detectedVendors, vendorDetections);

  const detectedEvidence = detectEvidenceItems(documents);
  const evidence = mergeEvidence(
    detectedEvidence,
    classifiedDocuments,
    documents,
    evidenceCoverage
  );

  const legacyGaps = detectGaps(documents, vendors);
  console.log('legacyGaps', legacyGaps); //tbd
  const factBasedGaps = detectGapsFromFacts(facts);
  console.log('factBasedGaps', factBasedGaps); //tbd
  const gaps = mergeFindings(
    [...factBasedGaps, ...legacyGaps],
    intelligenceRisks
  );

  const cloudRisk = buildCloudRisk(vendors);
  const dependencies = buildDependencies(vendors);
  const outageSimulation = buildOutageSimulation(documents, vendors);

  const highFindingCount = gaps.filter((finding) => finding.severity === 'High').length;
  const missingEvidenceCount = evidence.filter((item) => item.status === 'Missing').length;
  const hasUsExposure = vendors.some((vendor) => vendor.exposure === 'US');
  const hasAiExposure = vendors.some((vendor) => vendor.category === 'AI');
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
      icon: getDocumentIcon(doc.extension),
    })),
    vendors,
    gaps,
    evidence,
    cloudRisk,
    sovereigntyScores: buildSovereigntyScores({
      hasUsExposure,
      hasAiExposure,
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
