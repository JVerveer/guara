export type AppState = 'idle' | 'processing' | 'results';

export const PROCESSING_STEPS = [
  { label: 'Unpacking sample risk package', duration: 600 },
  { label: 'Identifying vendors across documents', duration: 900 },
  { label: 'Extracting evidence and certifications', duration: 800 },
  { label: 'Building technology dependency map', duration: 700 },
  { label: 'Calculating risk scores and criticality', duration: 900 },
  { label: 'Running regulatory gap analysis', duration: 800 },
  { label: 'Assessing concentration and residency risk', duration: 600 },
  { label: 'Generating audit-ready outputs', duration: 700 },
];

export const SAMPLE_SCENARIOS = [
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
    id: 'wealth-manager',
    name: 'Wealth Management Firm',
    industry: 'Wealth Management',
    documents: 7,
    vendors: 29,
    criticalVendors: 8,
    readinessScore: 76,
    mainRisk: 'Single-provider dependency for identity and access management.',
    headlineFinding: 'Identity provider concentration risk detected.',
    regionExposure: 'US SaaS dependency',
  },
  {
    id: 'crypto-exchange',
    name: 'Crypto Trading Platform',
    industry: 'Digital Assets',
    documents: 11,
    vendors: 57,
    criticalVendors: 16,
    readinessScore: 58,
    mainRisk: 'Critical transaction monitoring and custody services lack complete evidence.',
    headlineFinding: 'High-risk vendor evidence gaps detected.',
    regionExposure: 'Cross-border processing',
  },
  {
    id: 'sme-lending',
    name: 'SME Lending Platform',
    industry: 'Lending',
    documents: 9,
    vendors: 36,
    criticalVendors: 10,
    readinessScore: 69,
    mainRisk: 'Credit scoring, KYC, and cloud infrastructure depend heavily on third-party providers.',
    headlineFinding: 'Operational dependency chain detected.',
    regionExposure: 'EU and US vendor mix',
  },
  {
    id: 'payment-institution',
    name: 'Licensed Payment Institution',
    industry: 'Payments',
    documents: 14,
    vendors: 74,
    criticalVendors: 22,
    readinessScore: 61,
    mainRisk: 'Several critical ICT suppliers are missing annual review evidence.',
    headlineFinding: 'DORA review and evidence gaps detected.',
    regionExposure: 'High hyperscaler dependency',
  },
  {
    id: 'regtech-saas',
    name: 'RegTech SaaS Provider',
    industry: 'RegTech',
    documents: 6,
    vendors: 24,
    criticalVendors: 7,
    readinessScore: 84,
    mainRisk: 'AI tooling and analytics vendors are not fully mapped in the vendor register.',
    headlineFinding: 'AI provider dependency detected.',
    regionExposure: 'US AI provider dependency',
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
  {
    id: 'brokerage-platform',
    name: 'Online Brokerage Platform',
    industry: 'Investing',
    documents: 13,
    vendors: 62,
    criticalVendors: 18,
    readinessScore: 67,
    mainRisk: 'Market data, trading infrastructure, and customer support rely on multiple external providers.',
    headlineFinding: 'Critical service dependency map generated.',
    regionExposure: 'Global vendor footprint',
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
    a: 'Yes — the intended workflow is to export vendor inventories, gap reports, concentration risk reports, audit readiness summaries, and structured evidence packages.',
  },
];