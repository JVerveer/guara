export type AppState = 'idle' | 'processing' | 'results';

export const PROCESSING_STEPS = [
  { label: 'Unpacking risk package', duration: 600 },
  { label: 'Identifying vendors across documents', duration: 900 },
  { label: 'Extracting evidence and certifications', duration: 800 },
  { label: 'Building technology dependency map', duration: 700 },
  { label: 'Calculating risk scores and criticality', duration: 900 },
  { label: 'Running regulatory gap analysis', duration: 800 },
  { label: 'Assessing concentration and residency risk', duration: 600 },
  { label: 'Generating audit-ready outputs', duration: 700 },
];

export const FLOAT_DOCS = [
  { label: 'AWS Contract.pdf', color: '#EFF6FF', border: '#BFDBFE', icon: '📄' },
  { label: 'Vendor Inventory.xlsx', color: '#F0FDF4', border: '#BBF7D0', icon: '📊' },
  { label: 'SOC2 Report.pdf', color: '#FFF7ED', border: '#FED7AA', icon: '🔐' },
  { label: 'Questionnaire.xlsx', color: '#F5F3FF', border: '#DDD6FE', icon: '📋' },
  { label: 'ISO27001 Cert.pdf', color: '#FFF1F2', border: '#FECDD3', icon: '🏅' },
];

export const FAQS = [
  {
    q: 'What documents can I upload?',
    a: 'Contracts, vendor lists, questionnaires, SOC 2 reports, ISO certificates, AI policies, DPAs, vendor assessments, and existing registers in PDF, DOCX, XLSX, CSV, or ZIP format.',
  },
  {
    q: 'How does Guara identify vendors?',
    a: 'Guara reads every document and extracts vendor names, services, contract terms, evidence references, data locations, dependencies, and risk indicators automatically.',
  },
  {
    q: 'Can I use sample data first?',
    a: 'Yes. Click "Try Sample Package" to run a realistic analysis with no upload required.',
  },
  {
    q: 'What does Guara detect?',
    a: 'Guara detects critical vendor dependencies, cloud concentration risk, data residency exposure, missing evidence, AI provider dependency, and regulatory readiness gaps.',
  },
  {
    q: 'How are documents stored?',
    a: 'Documents should be encrypted in transit and at rest. You can design Guara with automatic deletion after analysis and a policy to never train models on customer data.',
  },
  {
    q: 'Can I export reports?',
    a: 'Yes — Guara exports vendor inventories, gap reports, concentration risk reports, audit readiness summaries, and structured evidence packages.',
  },
];
