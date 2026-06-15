import type {
  AnalysisResult,
  AuditItem,
  CloudRisk,
  DependencyItem,
  EvidenceItem,
  Finding,
  ScenarioSummary,
  Vendor,
} from './types';

export const SAMPLE_SCENARIOS: ScenarioSummary[] = [
  {
    id: 'fintech-payments',
    name: 'Fintech Payments Company',
    industry: 'Payments',
    documents: 8,
    vendors: 43,
    criticalVendors: 12,
    readinessScore: 72,
    mainRisk: 'High dependency on AWS and Stripe for critical payment operations.',
    headlineFinding: 'Cloud and payment processing concentration risk detected.',
    regionExposure: 'US provider dependency',
  },
  {
    id: 'digital-bank',
    name: 'Digital Bank',
    industry: 'Banking',
    documents: 12,
    vendors: 68,
    criticalVendors: 19,
    readinessScore: 64,
    mainRisk: 'Missing exit strategies for multiple critical ICT providers.',
    headlineFinding: 'Critical supplier governance gaps detected.',
    regionExposure: 'Mixed EU and US processing',
  },
  {
    id: 'insurance-platform',
    name: 'Insurance Platform',
    industry: 'Insurance',
    documents: 10,
    vendors: 51,
    criticalVendors: 14,
    readinessScore: 81,
    mainRisk: 'Sensitive policyholder data is processed by several non-EU vendors.',
    headlineFinding: 'Data residency exposure identified.',
    regionExposure: 'Non-EU data processing',
  },
  {
    id: 'european-neobank',
    name: 'European Neobank',
    industry: 'Banking',
    documents: 16,
    vendors: 91,
    criticalVendors: 28,
    readinessScore: 55,
    mainRisk: 'High reliance on a small number of hyperscalers and financial infrastructure providers.',
    headlineFinding: 'Severe concentration risk detected.',
    regionExposure: 'High non-EU infrastructure exposure',
  },
];

export const SAMPLE_DOCS = [
  { name: 'AWS_Master_Agreement_2024.pdf', size: '2.4 MB', type: 'Contract', icon: '📄' },
  { name: 'Vendor_Inventory_Q4.xlsx', size: '840 KB', type: 'Register', icon: '📊' },
  { name: 'Stripe_SOC2_Type2_Report.pdf', size: '4.1 MB', type: 'SOC Report', icon: '🔐' },
  { name: 'Third_Party_Questionnaires.xlsx', size: '1.2 MB', type: 'Questionnaire', icon: '📋' },
  { name: 'ISO27001_Certificate_Azure.pdf', size: '320 KB', type: 'Certificate', icon: '🏅' },
  { name: 'DORA_ICT_Register_Draft.xlsx', size: '560 KB', type: 'Register', icon: '📑' },
  { name: 'GCP_DPA_Agreement.pdf', size: '1.8 MB', type: 'DPA', icon: '📄' },
  { name: 'Vendor_Risk_Assessments_2024.pdf', size: '3.2 MB', type: 'Assessment', icon: '🗂️' },
];

export const SAMPLE_VENDORS: Vendor[] = [
  { name: 'AWS', service: 'Cloud Infrastructure', criticality: 'Critical', risk: 'High', score: 82, country: 'US', spend: '€420K', category: 'Cloud', exposure: 'US', dependency: 'Critical', dataType: 'Production workloads' },
  { name: 'Stripe', service: 'Payment Processing', criticality: 'Critical', risk: 'Medium', score: 91, country: 'US', spend: '€185K', category: 'Payments', exposure: 'US', dependency: 'Critical', dataType: 'Payment data' },
  { name: 'Microsoft Azure', service: 'Cloud Services', criticality: 'Critical', risk: 'Medium', score: 88, country: 'US', spend: '€310K', category: 'Cloud', exposure: 'US', dependency: 'Critical', dataType: 'Infrastructure data' },
  { name: 'Salesforce', service: 'CRM Platform', criticality: 'Important', risk: 'Low', score: 94, country: 'US', spend: '€96K', category: 'SaaS', exposure: 'US', dependency: 'High', dataType: 'Customer records' },
  { name: 'Twilio', service: 'Communications API', criticality: 'Important', risk: 'Low', score: 87, country: 'US', spend: '€42K', category: 'SaaS', exposure: 'US', dependency: 'Medium', dataType: 'Communications data' },
  { name: 'Okta', service: 'Identity & Access', criticality: 'Critical', risk: 'Low', score: 96, country: 'US', spend: '€78K', category: 'Identity', exposure: 'US', dependency: 'Critical', dataType: 'Identity data' },
  { name: 'Snowflake', service: 'Data Warehousing', criticality: 'Important', risk: 'Medium', score: 85, country: 'US', spend: '€124K', category: 'Data', exposure: 'US', dependency: 'High', dataType: 'Analytics data' },
  { name: 'Datadog', service: 'Monitoring & Observability', criticality: 'Standard', risk: 'Low', score: 92, country: 'US', spend: '€31K', category: 'Monitoring', exposure: 'US', dependency: 'Medium', dataType: 'Telemetry data' },
];

export const SAMPLE_GAPS: Finding[] = [
  { title: 'Missing Exit Strategy', severity: 'High', vendor: 'AWS', rec: 'Document a detailed vendor exit and substitutability plan per DORA Art. 28(3)(e).', article: 'Art. 28(3)(e)', category: 'DORA' },
  { title: 'Missing Annual Review', severity: 'Medium', vendor: 'Stripe', rec: 'Schedule annual performance and risk review per DORA Art. 28(3)(f).', article: 'Art. 28(3)(f)', category: 'DORA' },
  { title: 'Missing SOC Report', severity: 'High', vendor: 'Twilio', rec: 'Request updated SOC 2 Type II evidence from vendor.', article: 'Art. 28(2)', category: 'DORA' },
  { title: 'No Data Location Clause', severity: 'High', vendor: 'Snowflake', rec: 'Add data residency and transfer restriction clauses to contract.', article: 'Art. 28(3)(h)', category: 'DORA' },
  { title: 'Customer Data Processed Outside EU', severity: 'High', vendor: 'Snowflake', category: 'Data Residency', article: 'Residency', rec: 'Confirm data processing regions and document cross-border transfer safeguards for regulated customer data.' },
  { title: 'AI Supplier Not Fully Inventoried', severity: 'Medium', vendor: 'OpenAI / Azure AI', category: 'AI Act', article: 'AI Inventory', rec: 'Create an AI supplier inventory covering models, use cases, data inputs, and human oversight responsibilities.' },
  { title: 'Hyperscaler Dependency Exceeds Tolerance', severity: 'High', vendor: 'AWS', category: 'Digital Sovereignty', article: 'Concentration', rec: 'Assess substitutability and document a mitigation plan for critical cloud dependency.' },
];

export const SAMPLE_EVIDENCE: EvidenceItem[] = [
  { name: 'AWS SOC 2 Type II Report', vendor: 'AWS', type: 'SOC Report', status: 'Valid', expires: '2025-09-30' },
  { name: 'ISO 27001 Certificate', vendor: 'Microsoft Azure', type: 'Certificate', status: 'Valid', expires: '2026-03-15' },
  { name: 'Stripe SOC 2 Type II Report', vendor: 'Stripe', type: 'SOC Report', status: 'Valid', expires: '2025-12-31' },
  { name: 'Okta ISO 27001', vendor: 'Okta', type: 'Certificate', status: 'Valid', expires: '2026-01-20' },
  { name: 'Twilio SOC 2 Report', vendor: 'Twilio', type: 'SOC Report', status: 'Missing', expires: '—' },
  { name: 'Snowflake DPA', vendor: 'Snowflake', type: 'DPA', status: 'Expiring', expires: '2025-07-01' },
];

export const SAMPLE_CLOUD_RISK: CloudRisk[] = [
  { label: 'AWS', pct: 65, spend: '€420K' },
  { label: 'Azure', pct: 25, spend: '€310K' },
  { label: 'GCP', pct: 10, spend: '€98K' },
];

export const SAMPLE_AUDIT_ITEMS: AuditItem[] = [
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

const SOVEREIGNTY_SCORES: Record<string, AnalysisResult['sovereigntyScores']> = {
  'fintech-payments': { cloud: 52, data: 74, ai: 61, concentration: 48, regulatory: 72 },
  'digital-bank': { cloud: 58, data: 67, ai: 70, concentration: 55, regulatory: 64 },
  'insurance-platform': { cloud: 69, data: 49, ai: 75, concentration: 68, regulatory: 81 },
  'european-neobank': { cloud: 38, data: 54, ai: 47, concentration: 35, regulatory: 55 },
};

const DEPENDENCIES: Record<string, DependencyItem[]> = {
  'fintech-payments': [
    { vendor: 'AWS', service: 'Cloud infrastructure', impact: 'Payments API, customer portal, analytics', icon: 'cloud' },
    { vendor: 'Stripe', service: 'Payment processing', impact: 'Card acquiring, settlement, refunds', icon: 'payments' },
    { vendor: 'Okta', service: 'Identity access', impact: 'Employee access, admin access', icon: 'identity' },
    { vendor: 'Snowflake', service: 'Data platform', impact: 'Reporting, fraud analytics', icon: 'data' },
  ],
  default: [
    { vendor: 'AWS', service: 'Cloud infrastructure', impact: 'Production workloads and data processing', icon: 'cloud' },
    { vendor: 'Stripe', service: 'Payments', impact: 'Customer payments and settlement', icon: 'payments' },
    { vendor: 'Okta', service: 'Identity access', impact: 'Authentication and access management', icon: 'identity' },
    { vendor: 'Snowflake', service: 'Data platform', impact: 'Reporting and analytics', icon: 'data' },
  ],
};

const BOARD_RISKS: Record<string, string[]> = {
  'fintech-payments': [
    'High dependency on AWS and Stripe for critical payment operations.',
    'No documented exit strategy found for AWS.',
    'US provider dependency across critical infrastructure.',
  ],
  default: [
    'Critical technology dependencies require executive attention.',
    'Vendor evidence coverage is incomplete.',
    'Concentration risk exists across core service providers.',
  ],
};

const AUDIT_RECOMMENDATIONS: Record<string, string[]> = {
  'fintech-payments': [
    'Validate AWS exit strategy and payment continuity plan.',
    'Review Stripe concentration and settlement dependency.',
    'Document US provider dependency for board-level technology risk oversight.',
  ],
  default: [
    'Validate exit strategies for critical technology providers.',
    'Close missing evidence gaps before audit review.',
    'Prepare board-level summary of cloud, AI, and data dependency exposure.',
  ],
};

export function getSampleScenario(id?: string) {
  return SAMPLE_SCENARIOS.find((scenario) => scenario.id === id) ?? SAMPLE_SCENARIOS[0];
}

export function getSampleAnalysisResult(id?: string): AnalysisResult {
  const scenario = getSampleScenario(id);

  return {
    source: 'sample',
    generatedAt: new Date().toISOString(),
    scenario,
    documents: SAMPLE_DOCS.slice(0, scenario.documents),
    vendors: SAMPLE_VENDORS,
    gaps: SAMPLE_GAPS,
    evidence: SAMPLE_EVIDENCE,
    cloudRisk: SAMPLE_CLOUD_RISK,
    sovereigntyScores: SOVEREIGNTY_SCORES[scenario.id] ?? SOVEREIGNTY_SCORES['fintech-payments'],
    dependencies: DEPENDENCIES[scenario.id] ?? DEPENDENCIES.default,
    outageSimulation: {
      provider: scenario.id === 'european-neobank' ? 'AWS and core banking provider' : 'AWS',
      affectedDependencies: scenario.id === 'european-neobank' ? 31 : 14,
      affectedServices: ['Payments API', 'Customer portal', 'Fraud monitoring', 'Analytics'],
      impact: scenario.id === 'european-neobank' ? 'Severe' : 'High',
      recovery: scenario.id === 'european-neobank' ? '10–20 days without validated contingency plan' : '5–10 days without documented exit plan',
      recommendation: 'Define exit options and test service recovery for critical technology dependencies.',
    },
    boardRisks: BOARD_RISKS[scenario.id] ?? BOARD_RISKS.default,
    auditItems: SAMPLE_AUDIT_ITEMS,
    auditRecommendations: AUDIT_RECOMMENDATIONS[scenario.id] ?? AUDIT_RECOMMENDATIONS.default,
  };
}
