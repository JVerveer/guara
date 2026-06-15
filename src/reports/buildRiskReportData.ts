import {
  ALL_VENDORS,
  CLOUD_RISK,
  DORA_GAPS,
  EVIDENCE_ITEMS,
} from '../data/constants';

export type Severity = 'High' | 'Medium' | 'Low';

export type RiskReportScenario = {
  id: string;
  name: string;
  industry: string;
  vendors: number;
  criticalVendors: number;
  documents: number;
  readinessScore: number;
  headlineFinding: string;
  mainRisk: string;
  regionExposure: string;
};

type FindingCategory =
  | 'DORA'
  | 'Data Residency'
  | 'AI Act'
  | 'Digital Sovereignty'
  | 'Operational Resilience';

const SOVEREIGNTY_SCORES: Record<
  string,
  {
    cloud: number;
    data: number;
    ai: number;
    concentration: number;
    regulatory: number;
  }
> = {
  'fintech-payments': { cloud: 52, data: 74, ai: 61, concentration: 48, regulatory: 72 },
  'digital-bank': { cloud: 58, data: 67, ai: 70, concentration: 55, regulatory: 64 },
  'insurance-platform': { cloud: 69, data: 49, ai: 75, concentration: 68, regulatory: 81 },
  'wealth-manager': { cloud: 64, data: 72, ai: 66, concentration: 59, regulatory: 76 },
  'crypto-exchange': { cloud: 45, data: 51, ai: 58, concentration: 43, regulatory: 58 },
  'sme-lending': { cloud: 61, data: 68, ai: 55, concentration: 57, regulatory: 69 },
  'payment-institution': { cloud: 49, data: 62, ai: 60, concentration: 46, regulatory: 61 },
  'regtech-saas': { cloud: 73, data: 78, ai: 42, concentration: 71, regulatory: 84 },
  'european-neobank': { cloud: 38, data: 54, ai: 47, concentration: 35, regulatory: 55 },
  'brokerage-platform': { cloud: 57, data: 63, ai: 69, concentration: 52, regulatory: 67 },
};

const SIMULATIONS: Record<
  string,
  {
    provider: string;
    affectedDependencies: number;
    affectedServices: string[];
    impact: 'Medium' | 'High' | 'Severe';
    recovery: string;
    recommendation: string;
  }
> = {
  'fintech-payments': {
    provider: 'AWS',
    affectedDependencies: 14,
    affectedServices: ['Payments API', 'Customer portal', 'Fraud monitoring', 'Analytics'],
    impact: 'High',
    recovery: '5–10 days without documented exit plan',
    recommendation: 'Document AWS substitutability and validate failover for payment-critical services.',
  },
  'digital-bank': {
    provider: 'Microsoft Azure',
    affectedDependencies: 22,
    affectedServices: ['Mobile banking', 'API gateway', 'Monitoring', 'Internal identity integrations'],
    impact: 'High',
    recovery: '7–14 days due to missing exit strategies',
    recommendation: 'Run a critical ICT provider outage exercise and validate recovery ownership.',
  },
  'insurance-platform': {
    provider: 'Microsoft Azure',
    affectedDependencies: 11,
    affectedServices: ['Claims platform', 'Policyholder portal', 'Reporting', 'Document workflows'],
    impact: 'High',
    recovery: '4–8 days depending on backup region readiness',
    recommendation: 'Validate claims-processing continuity and confirm backup processing locations.',
  },
  'european-neobank': {
    provider: 'AWS and core banking provider',
    affectedDependencies: 31,
    affectedServices: ['Core ledger', 'Customer onboarding', 'Payments', 'Customer support'],
    impact: 'Severe',
    recovery: '10–20 days without validated contingency plan',
    recommendation: 'Prioritise board-level review of hyperscaler and financial infrastructure concentration.',
  },
  default: {
    provider: 'Primary cloud provider',
    affectedDependencies: 12,
    affectedServices: ['Customer portal', 'Data warehouse', 'Internal analytics', 'API services'],
    impact: 'High',
    recovery: '5–10 days depending on backup provider readiness',
    recommendation: 'Define exit options and test service recovery for critical technology dependencies.',
  },
};

const EXTRA_FINDINGS: Array<{
  title: string;
  severity: Severity;
  vendor: string;
  category: FindingCategory;
  article: string;
  rec: string;
}> = [
  {
    title: 'Customer Data Processed Outside EU',
    severity: 'High',
    vendor: 'Snowflake',
    category: 'Data Residency',
    article: 'Residency',
    rec: 'Confirm data processing regions and document cross-border transfer safeguards for regulated customer data.',
  },
  {
    title: 'AI Supplier Not Fully Inventoried',
    severity: 'Medium',
    vendor: 'OpenAI / Azure AI',
    category: 'AI Act',
    article: 'AI Inventory',
    rec: 'Create an AI supplier inventory covering models, use cases, data inputs, and human oversight responsibilities.',
  },
  {
    title: 'Hyperscaler Dependency Exceeds Tolerance',
    severity: 'High',
    vendor: 'AWS',
    category: 'Digital Sovereignty',
    article: 'Concentration',
    rec: 'Assess substitutability and document a mitigation plan for critical cloud dependency.',
  },
  {
    title: 'No Validated Recovery Scenario',
    severity: 'Medium',
    vendor: 'Microsoft Azure',
    category: 'Operational Resilience',
    article: 'Resilience',
    rec: 'Run and document a provider outage simulation for critical services supported by this vendor.',
  },
];

const BOARD_RECOMMENDATIONS: Record<string, string[]> = {
  'fintech-payments': [
    'Validate AWS exit strategy and payment continuity plan.',
    'Review Stripe concentration and settlement dependency.',
    'Document US provider dependency for board-level technology risk oversight.',
  ],
  'digital-bank': [
    'Prioritise missing exit strategies for critical ICT providers.',
    'Complete annual review evidence for high-impact suppliers.',
    'Validate resilience testing for infrastructure and identity providers.',
  ],
  'insurance-platform': [
    'Confirm data residency safeguards for policyholder data.',
    'Review claims-processing dependency on external cloud providers.',
    'Prepare evidence pack for continuity and recovery controls.',
  ],
  'european-neobank': [
    'Escalate hyperscaler and infrastructure dependency to board risk committee.',
    'Run critical provider outage simulation before formal review.',
    'Create remediation plan for low readiness and concentration exposure.',
  ],
  default: [
    'Validate exit strategies for critical technology providers.',
    'Close missing evidence gaps before audit review.',
    'Prepare board-level summary of cloud, AI, and data dependency exposure.',
  ],
};

const AUDIT_ITEMS = [
  { label: 'Technology Dependency Map', pages: 8, type: 'Board Pack' },
  { label: 'Critical Supplier Register', pages: 6, type: 'Register' },
  { label: 'DORA ICT Third-Party Register', pages: 12, type: 'Regulatory' },
  { label: 'Gap & Risk Analysis Report', pages: 18, type: 'Risk Report' },
  { label: 'Evidence Inventory', pages: 9, type: 'Evidence' },
  { label: 'Concentration Risk Assessment', pages: 7, type: 'Risk Report' },
  { label: 'Digital Sovereignty Summary', pages: 5, type: 'Board Pack' },
  { label: 'Remediation Action Plan', pages: 11, type: 'Action Plan' },
  { label: 'Audit Readiness Summary', pages: 3, type: 'Executive Summary' },
];

export function buildRiskReportData(activeScenario: RiskReportScenario) {
  const sovereigntyScores =
    SOVEREIGNTY_SCORES[activeScenario.id] ?? SOVEREIGNTY_SCORES['fintech-payments'];

  const sovereigntyScore = Math.round(
    (sovereigntyScores.cloud +
      sovereigntyScores.data +
      sovereigntyScores.ai +
      sovereigntyScores.concentration +
      sovereigntyScores.regulatory) /
      5
  );

  const doraFindings = DORA_GAPS.map((gap) => ({
    ...gap,
    severity: gap.severity as Severity,
    category: 'DORA' as FindingCategory,
  }));

  const findings = [...doraFindings, ...EXTRA_FINDINGS];

  const evidenceValid = EVIDENCE_ITEMS.filter((item) => item.status === 'Valid').length;
  const evidenceMissing = EVIDENCE_ITEMS.filter((item) => item.status === 'Missing').length;
  const evidenceExpiring = EVIDENCE_ITEMS.filter((item) => item.status === 'Expiring').length;
  const evidenceCoverage = Math.round((evidenceValid / EVIDENCE_ITEMS.length) * 100);

  const simulation = SIMULATIONS[activeScenario.id] ?? SIMULATIONS.default;
  const totalAuditPages = AUDIT_ITEMS.reduce((sum, item) => sum + item.pages, 0);

  return {
    generatedAt: new Date().toISOString(),
    scenario: activeScenario,
    overview: {
      sovereigntyScore,
      sovereigntyScores,
      highGaps: doraFindings.filter((gap) => gap.severity === 'High'),
    },
    vendors: {
      all: ALL_VENDORS,
      criticalCount: ALL_VENDORS.filter((vendor) => vendor.criticality === 'Critical').length,
    },
    gaps: {
      findings,
      highCount: findings.filter((finding) => finding.severity === 'High').length,
      categories: Array.from(new Set(findings.map((finding) => finding.category))),
    },
    evidence: {
      items: EVIDENCE_ITEMS,
      valid: evidenceValid,
      missing: evidenceMissing,
      expiring: evidenceExpiring,
      coverage: evidenceCoverage,
    },
    concentration: {
      cloudRisk: CLOUD_RISK,
      simulation,
      topProvider: CLOUD_RISK[0],
    },
    audit: {
      items: AUDIT_ITEMS,
      totalPages: totalAuditPages,
      recommendations:
        BOARD_RECOMMENDATIONS[activeScenario.id] ?? BOARD_RECOMMENDATIONS.default,
    },
  };
}

export type RiskReportData = ReturnType<typeof buildRiskReportData>;
