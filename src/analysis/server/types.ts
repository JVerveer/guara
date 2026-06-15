export type ParsedDocument = {
  fileName: string;
  extension: string;
  text: string;
  size: number;
};

export type Severity = 'High' | 'Medium' | 'Low';

export type Criticality = 'Critical' | 'Important' | 'Standard' | 'Low';

export type VendorCategory =
  | 'Cloud'
  | 'Payments'
  | 'Identity'
  | 'Data'
  | 'SaaS'
  | 'AI'
  | 'Monitoring';

export type ExposureRegion = 'EU' | 'US' | 'Global';

export type FindingCategory =
  | 'DORA'
  | 'Data Residency'
  | 'AI Act'
  | 'Digital Sovereignty'
  | 'Operational Resilience';

export type KnownVendor = {
  name: string;
  aliases: string[];
  category: VendorCategory;
  service: string;
  exposure: ExposureRegion;
};
