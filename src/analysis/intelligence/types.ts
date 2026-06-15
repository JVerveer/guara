export type DocumentType =
  | 'Contract'
  | 'SOC2'
  | 'ISO27001'
  | 'Questionnaire'
  | 'DPA'
  | 'Policy'
  | 'Register'
  | 'BCP'
  | 'ExitPlan'
  | 'Unknown';

export interface ClassifiedDocument {
  fileName: string;
  documentType: DocumentType;
  confidence: number;
}

export interface VendorDetection {
  name: string;
  occurrences: number;
}

export interface EvidenceCoverage {
  contracts: boolean;
  soc2: boolean;
  iso27001: boolean;
  bcp: boolean;
  exitPlan: boolean;
  dpa: boolean;
}

export interface RiskFinding {
  title: string;
  severity: 'High' | 'Medium' | 'Low';
  category:
    | 'DORA'
    | 'AI Act'
    | 'Digital Sovereignty'
    | 'Data Residency'
    | 'Operational Resilience';
  recommendation: string;
}