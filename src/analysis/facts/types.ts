import type { FindingCategory, Severity } from '../types';

export type FactConfidence = number;

export interface FactSource {
  document: string;
  excerpt: string;
  page?: number;
  chunkId?: string;
  confidence: FactConfidence;
}

export interface BaseFact {
  id: string;
  source: FactSource;
}

export interface VendorFact extends BaseFact {
  type: 'vendor';
  vendorName: string;
  aliases?: string[];
  service?: string;
  category?: 'Cloud' | 'Payments' | 'Identity' | 'Data' | 'SaaS' | 'AI' | 'Monitoring';
}

export interface EvidenceFact extends BaseFact {
  type: 'evidence';
  evidenceType:
    | 'Contract'
    | 'SOC2'
    | 'ISO27001'
    | 'Questionnaire'
    | 'DPA'
    | 'Policy'
    | 'Register'
    | 'BCP'
    | 'ExitPlan'
    | 'AIPolicy'
    | 'SubprocessorDisclosure'
    | 'RiskAssessment';

  vendorName?: string;
  status?: 'Valid' | 'Missing' | 'Expiring';
  expiresAt?: string;
}

export interface DependencyFact extends BaseFact {
  type: 'dependency';
  vendorName: string;
  dependencyType: 'Cloud' | 'Payments' | 'Identity' | 'Data' | 'AI' | 'SaaS' | 'Monitoring';
  service?: string;
  businessImpact?: string;
  criticality?: 'Critical' | 'Important' | 'Standard' | 'Low';
}

export interface DataResidencyFact extends BaseFact {
  type: 'dataResidency';
  vendorName?: string;
  region: 'EU' | 'US' | 'Global' | 'Unknown';
  dataType?: string;
}

export interface ContractFact extends BaseFact {
  type: 'contract';
  vendorName?: string;
  clauseType:
    | 'AuditRights'
    | 'ExitAssistance'
    | 'Termination'
    | 'Subprocessor'
    | 'DataLocation'
    | 'BusinessContinuity'
    | 'Security'
    | 'Unknown';
}

export interface AnalysisFacts {
  vendors: VendorFact[];
  evidence: EvidenceFact[];
  dependencies: DependencyFact[];
  residency: DataResidencyFact[];
  contracts: ContractFact[];
}

export interface FindingTrace {
  document: string;
  excerpt: string;
  page?: number;
  chunkId?: string;
  confidence: number;
}

export interface TraceableRiskFinding {
  title: string;
  severity: Severity;
  category: FindingCategory;
  recommendation: string;
  vendor?: string;
  article?: string;
  trace: FindingTrace[];
}
