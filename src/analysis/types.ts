export type Severity = 'High' | 'Medium' | 'Low';
export type Criticality = 'Critical' | 'Important' | 'Standard' | 'Low';
export type EvidenceStatus = 'Valid' | 'Missing' | 'Expiring';
export type ExposureRegion = 'EU' | 'US' | 'Global';

export type FindingCategory =
  | 'DORA'
  | 'Data Residency'
  | 'AI Act'
  | 'Digital Sovereignty'
  | 'Operational Resilience';

export type ScenarioSummary = {
  id: string;
  name: string;
  industry: string;
  documents: number;
  vendors: number;
  criticalVendors: number;
  readinessScore: number;
  mainRisk: string;
  headlineFinding: string;
  regionExposure: string;
};

export type DocumentItem = {
  name: string;
  size?: string;
  type: string;
  icon?: string;
};

export type Vendor = {
  name: string;
  service: string;
  criticality: Criticality;
  risk: Severity;
  score: number;
  country: string;
  spend: string;
  category?: 'Cloud' | 'Payments' | 'Identity' | 'Data' | 'SaaS' | 'AI' | 'Monitoring';
  exposure?: ExposureRegion;
  dependency?: 'Critical' | 'High' | 'Medium' | 'Low';
  dataType?: string;
};

export type Finding = {
  title: string;
  severity: Severity;
  vendor: string;
  rec: string;
  article: string;
  category: FindingCategory;
};

export type EvidenceItem = {
  name: string;
  vendor: string;
  type: string;
  status: EvidenceStatus;
  expires: string;
};

export type CloudRisk = {
  label: string;
  pct: number;
  spend: string;
};

export type SovereigntyScores = {
  cloud: number;
  data: number;
  ai: number;
  concentration: number;
  regulatory: number;
};

export type DependencyItem = {
  vendor: string;
  service: string;
  impact: string;
  icon: 'cloud' | 'payments' | 'identity' | 'data';
};

export type OutageSimulation = {
  provider: string;
  affectedDependencies: number;
  affectedServices: string[];
  impact: 'Medium' | 'High' | 'Severe';
  recovery: string;
  recommendation: string;
};

export type AuditItem = {
  label: string;
  pages: number;
  type: string;
};

export type AnalysisResult = {
  source: 'sample' | 'upload';
  generatedAt: string;
  scenario: ScenarioSummary;
  documents: DocumentItem[];
  vendors: Vendor[];
  gaps: Finding[];
  evidence: EvidenceItem[];
  cloudRisk: CloudRisk[];
  sovereigntyScores: SovereigntyScores;
  dependencies: DependencyItem[];
  outageSimulation: OutageSimulation;
  boardRisks: string[];
  auditItems: AuditItem[];
  auditRecommendations: string[];
};
