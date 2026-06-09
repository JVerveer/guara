export type AppState = 'idle' | 'processing' | 'results';

export const PROCESSING_STEPS = [
  { label: 'Unpacking sample DORA package', duration: 600 },
  { label: 'Identifying vendors across documents', duration: 900 },
  { label: 'Extracting evidence and certifications', duration: 800 },
  { label: 'Building ICT Third-Party Register', duration: 700 },
  { label: 'Calculating risk scores and criticality', duration: 900 },
  { label: 'Running DORA gap analysis', duration: 800 },
  { label: 'Assessing concentration risk', duration: 600 },
  { label: 'Generating audit package', duration: 700 },
];

export const SAMPLE_DOCS = [
  { name: 'AWS_Master_Agreement_2024.pdf', size: '2.4 MB', type: 'Contract', icon: '📄' },
  { name: 'Vendor_Inventory_Q4.xlsx', size: '840 KB', type: 'Register', icon: '📊' },
  { name: 'Stripe_SOC2_Type2_Report.pdf', size: '4.1 MB', type: 'SOC Report', icon: '🔐' },
  { name: 'Third_Party_Questionnaires.xlsx', size: '1.2 MB', type: 'Questionnaire', icon: '📋' },
  { name: 'ISO27001_Certificate_Azure.pdf', size: '320 KB', type: 'Certificate', icon: '🏅' },
  { name: 'DORA_ICT_Register_Draft.xlsx', size: '560 KB', type: 'DORA Register', icon: '📑' },
  { name: 'GCP_DPA_Agreement.pdf', size: '1.8 MB', type: 'Contract', icon: '📄' },
  { name: 'Vendor_Risk_Assessments_2024.pdf', size: '3.2 MB', type: 'Assessment', icon: '🗂️' },
];

export const ALL_VENDORS = [
  { name: 'AWS', service: 'Cloud Infrastructure', criticality: 'Critical', risk: 'High', score: 82, country: 'US', spend: '€420K' },
  { name: 'Stripe', service: 'Payment Processing', criticality: 'Critical', risk: 'Medium', score: 91, country: 'US', spend: '€185K' },
  { name: 'Microsoft Azure', service: 'Cloud Services', criticality: 'Critical', risk: 'Medium', score: 88, country: 'US', spend: '€310K' },
  { name: 'Salesforce', service: 'CRM Platform', criticality: 'Important', risk: 'Low', score: 94, country: 'US', spend: '€96K' },
  { name: 'Twilio', service: 'Communications API', criticality: 'Important', risk: 'Low', score: 87, country: 'US', spend: '€42K' },
  { name: 'Okta', service: 'Identity & Access', criticality: 'Critical', risk: 'Low', score: 96, country: 'US', spend: '€78K' },
  { name: 'Snowflake', service: 'Data Warehousing', criticality: 'Important', risk: 'Medium', score: 85, country: 'US', spend: '€124K' },
  { name: 'Datadog', service: 'Monitoring & Observability', criticality: 'Standard', risk: 'Low', score: 92, country: 'US', spend: '€31K' },
];

export const DORA_GAPS = [
  { title: 'Missing Exit Strategy', severity: 'High', vendor: 'AWS', rec: 'Document a detailed vendor exit and substitutability plan per DORA Art. 28(3)(e).', article: 'Art. 28(3)(e)' },
  { title: 'Missing Annual Review', severity: 'Medium', vendor: 'Stripe', rec: 'Schedule annual performance and risk review per DORA Art. 28(3)(f).', article: 'Art. 28(3)(f)' },
  { title: 'Missing SOC Report', severity: 'High', vendor: 'Twilio', rec: 'Request updated SOC 2 Type II evidence from vendor.', article: 'Art. 28(2)' },
  { title: 'Incomplete Sub-contractor Disclosure', severity: 'Medium', vendor: 'Azure', rec: 'Obtain full sub-processor list and assess fourth-party risk.', article: 'Art. 28(3)(j)' },
  { title: 'No Data Location Clause', severity: 'High', vendor: 'Snowflake', rec: 'Add data residency and transfer restriction clauses to contract.', article: 'Art. 28(3)(h)' },
  { title: 'No Audit Rights Clause', severity: 'Medium', vendor: 'Datadog', rec: 'Include right-to-audit provision in next contract renewal.', article: 'Art. 28(3)(g)' },
  { title: 'Missing Business Continuity Plan', severity: 'Low', vendor: 'Salesforce', rec: 'Request vendor BCP and test recovery objectives alignment.', article: 'Art. 28(3)(c)' },
  { title: 'Unsigned DPA', severity: 'High', vendor: 'Twilio', rec: 'Execute Data Processing Agreement with updated SCCs.', article: 'Art. 28(2)' },
];

export const EVIDENCE_ITEMS = [
  { name: 'AWS SOC 2 Type II Report', vendor: 'AWS', type: 'SOC Report', status: 'Valid', expires: '2025-09-30' },
  { name: 'ISO 27001 Certificate', vendor: 'Microsoft Azure', type: 'Certificate', status: 'Valid', expires: '2026-03-15' },
  { name: 'Stripe SOC 2 Type II Report', vendor: 'Stripe', type: 'SOC Report', status: 'Valid', expires: '2025-12-31' },
  { name: 'Okta ISO 27001', vendor: 'Okta', type: 'Certificate', status: 'Valid', expires: '2026-01-20' },
  { name: 'Twilio SOC 2 Report', vendor: 'Twilio', type: 'SOC Report', status: 'Missing', expires: '—' },
  { name: 'Snowflake DPA', vendor: 'Snowflake', type: 'DPA', status: 'Expiring', expires: '2025-07-01' },
];

export const CLOUD_RISK = [
  { label: 'AWS', pct: 65, color: '#FF9900', spend: '€420K' },
  { label: 'Azure', pct: 25, color: '#0078D4', spend: '€310K' },
  { label: 'GCP', pct: 10, color: '#4285F4', spend: '€98K' },
];

export const FLOAT_DOCS = [
  { label: 'AWS Contract.pdf', color: '#EFF6FF', border: '#BFDBFE', icon: '📄' },
  { label: 'Vendor Inventory.xlsx', color: '#F0FDF4', border: '#BBF7D0', icon: '📊' },
  { label: 'SOC2 Report.pdf', color: '#FFF7ED', border: '#FED7AA', icon: '🔐' },
  { label: 'Questionnaire.xlsx', color: '#F5F3FF', border: '#DDD6FE', icon: '📋' },
  { label: 'ISO27001 Cert.pdf', color: '#FFF1F2', border: '#FECDD3', icon: '🏅' },
];

export const FAQS = [
  { q: 'What documents can I upload?', a: 'Contracts, vendor lists, questionnaires, SOC 2 reports, ISO certificates, and existing DORA registers in PDF, DOCX, XLSX, CSV, or ZIP format.' },
  { q: 'How does Guara identify vendors?', a: 'Our AI engine reads every document and extracts vendor names, services, contract terms, and dependencies — building a register automatically.' },
  { q: 'Can I use sample data first?', a: 'Yes. Click "Try Sample DORA Package" to run a full analysis on a realistic 43-vendor dataset with no upload required.' },
  { q: 'How accurate is the analysis?', a: 'Guara achieves >95% vendor identification accuracy on standard compliance documents and flags gaps with explanations for human review.' },
  { q: 'How are documents stored?', a: 'Documents are encrypted in transit and at rest. You can set automatic deletion after analysis. We never train models on your data.' },
  { q: 'Can I export reports?', a: 'Yes — export the full audit package as PDF, Excel, or structured JSON. Regulator-ready formatting is included.' },
];
