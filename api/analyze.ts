import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable, {
  type File as FormidableFile,
  type Files,
} from 'formidable';
import fs from 'node:fs/promises';
import JSZip from 'jszip';

export const config = {
  api: {
    bodyParser: false,
  },
};

type ParsedDocument = {
  fileName: string;
  extension: string;
  text: string;
  size: number;
};

type Severity = 'High' | 'Medium' | 'Low';
type Criticality = 'Critical' | 'Important' | 'Standard' | 'Low';

type FindingCategory =
  | 'DORA'
  | 'Data Residency'
  | 'AI Act'
  | 'Digital Sovereignty'
  | 'Operational Resilience';

type FindingTrace = {
  document: string;
  excerpt: string;
  page?: number;
  chunkId?: string;
  confidence: number;
};

type Finding = {
  title: string;
  severity: Severity;
  vendor: string;
  category: FindingCategory;
  article: string;
  rec: string;
  trace: FindingTrace[];
};

type EvidenceItem = {
  name: string;
  vendor: string;
  type: string;
  status: 'Valid' | 'Missing' | 'Expiring';
  expires: string;
  trace: FindingTrace[];
};

type VendorItem = {
  name: string;
  service: string;
  criticality: Criticality;
  risk: Severity;
  score: number;
  country: string;
  spend: string;
  category: string;
  exposure: 'EU' | 'US' | 'Global';
  dependency: 'Critical' | 'High' | 'Medium' | 'Low';
  dataType: string;
  trace: FindingTrace[];
};

const SUPPORTED_EXTENSIONS = [
  'pdf',
  'docx',
  'xlsx',
  'xls',
  'csv',
  'zip',
  'txt',
  'md',
  'json',
];

const KNOWN_VENDORS = [
  {
    name: 'AWS',
    aliases: ['aws', 'amazon web services'],
    category: 'Cloud',
    service: 'Cloud Infrastructure',
    exposure: 'US',
  },
  {
    name: 'Microsoft Azure',
    aliases: ['microsoft azure', 'azure'],
    category: 'Cloud',
    service: 'Cloud Services',
    exposure: 'US',
  },
  {
    name: 'Google Cloud Platform',
    aliases: ['google cloud platform', 'google cloud', 'gcp'],
    category: 'Cloud',
    service: 'Cloud Infrastructure',
    exposure: 'US',
  },
  {
    name: 'Stripe',
    aliases: ['stripe'],
    category: 'Payments',
    service: 'Payment Processing',
    exposure: 'US',
  },
  {
    name: 'OpenAI',
    aliases: ['openai', 'gpt'],
    category: 'AI',
    service: 'AI Services',
    exposure: 'US',
  },
  {
    name: 'Snowflake',
    aliases: ['snowflake'],
    category: 'Data',
    service: 'Data Platform',
    exposure: 'US',
  },
  {
    name: 'Okta',
    aliases: ['okta'],
    category: 'Identity',
    service: 'Identity & Access',
    exposure: 'US',
  },
  {
    name: 'Twilio',
    aliases: ['twilio'],
    category: 'SaaS',
    service: 'Communications API',
    exposure: 'US',
  },
  {
    name: 'Salesforce',
    aliases: ['salesforce'],
    category: 'SaaS',
    service: 'CRM Platform',
    exposure: 'US',
  },
  {
    name: 'Datadog',
    aliases: ['datadog'],
    category: 'Monitoring',
    service: 'Monitoring & Observability',
    exposure: 'US',
  },
] as const;

function getExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function isSupportedExtension(extension: string) {
  return SUPPORTED_EXTENSIONS.includes(extension.toLowerCase());
}

function isHiddenOrSystemFile(fileName: string) {
  return (
    fileName.startsWith('__MACOSX/') ||
    fileName.includes('/.') ||
    fileName.startsWith('.') ||
    fileName.endsWith('.DS_Store')
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return 'Failed to analyze uploaded documents.';
}

async function parseForm(request: VercelRequest): Promise<Files> {
  const form = formidable({
    multiples: true,
    keepExtensions: true,
    maxFileSize: 25 * 1024 * 1024,
    maxTotalFileSize: 50 * 1024 * 1024,
  });

  return new Promise((resolve, reject) => {
    form.parse(request, (error, _fields, files) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(files);
    });
  });
}

function flattenFormidableFiles(files: Files): FormidableFile[] {
  return Object.values(files)
    .flat()
    .filter(Boolean) as FormidableFile[];
}

async function extractZip(buffer: Buffer, sourceName: string): Promise<ParsedDocument[]> {
  const zip = await JSZip.loadAsync(buffer);
  const docs: ParsedDocument[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || isHiddenOrSystemFile(path)) {
      continue;
    }

    const extension = getExtension(path);

    if (!isSupportedExtension(extension) || extension === 'zip') {
      continue;
    }

    const fileBuffer = await entry.async('nodebuffer');
    const fileName = path.split('/').pop() ?? path;

    docs.push(await extractText(fileName, extension, fileBuffer));
  }

  if (docs.length === 0) {
    throw new Error(`No supported documents found inside ${sourceName}.`);
  }

  return docs;
}

async function extractPdfText(buffer: Buffer) {
  const { PDFParse } = await import('pdf-parse');

  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();

  const text = result.text?.trim() ?? '';

  if (!text) {
    return [
      'PDF uploaded, but no selectable text could be extracted.',
      'This PDF may be scanned or image-based.',
      'OCR is not yet enabled for scanned PDFs.',
    ].join('\n');
  }

  return text;
}

async function extractDocxText(buffer: Buffer) {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });

  return result.value;
}

async function extractSpreadsheetText(buffer: Buffer) {
  const XLSX = await import('xlsx');

  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
  });

  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);

    return `Sheet: ${sheetName}\n${csv}`;
  }).join('\n\n');
}

async function extractText(
  fileName: string,
  extension: string,
  buffer: Buffer
): Promise<ParsedDocument> {
  let text = '';

  if (extension === 'pdf') {
    text = await extractPdfText(buffer);
  } else if (extension === 'docx') {
    text = await extractDocxText(buffer);
  } else if (extension === 'xlsx' || extension === 'xls') {
    text = await extractSpreadsheetText(buffer);
  } else if (
    extension === 'csv' ||
    extension === 'txt' ||
    extension === 'md' ||
    extension === 'json'
  ) {
    text = buffer.toString('utf8');
  }

  return {
    fileName,
    extension,
    text: text.trim(),
    size: buffer.length,
  };
}

function getDocumentIcon(extension: string) {
  if (extension === 'csv' || extension === 'xlsx' || extension === 'xls') return '📊';
  if (extension === 'pdf') return '📄';
  if (extension === 'docx') return '📝';

  return '📎';
}

function getCombinedText(documents: ParsedDocument[]) {
  return documents
    .map((document) => `${document.fileName}\n${document.text}`)
    .join('\n')
    .toLowerCase();
}

function detectIndustry(text: string) {
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

function cleanExcerpt(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function findBestExcerpt(text: string, terms: string[], radius = 180) {
  const lower = text.toLowerCase();

  for (const term of terms) {
    const index = lower.indexOf(term.toLowerCase());

    if (index >= 0) {
      const start = Math.max(0, index - radius);
      const end = Math.min(text.length, index + term.length + radius);

      return cleanExcerpt(text.slice(start, end));
    }
  }

  return cleanExcerpt(text.slice(0, 300));
}

function makeTrace(args: {
  document: string;
  excerpt: string;
  confidence?: number;
}): FindingTrace {
  return {
    document: args.document,
    excerpt: cleanExcerpt(args.excerpt),
    confidence: Math.max(0, Math.min(1, args.confidence ?? 0.75)),
  };
}

function findTraceForTerms(
  documents: ParsedDocument[],
  terms: string[],
  confidence = 0.78
): FindingTrace[] {
  const matchingDocument = documents.find((document) => {
    const value = `${document.fileName}\n${document.text}`.toLowerCase();
    return terms.some((term) => value.includes(term.toLowerCase()));
  });

  if (!matchingDocument) {
    return [];
  }

  const sourceText = `${matchingDocument.fileName}\n${matchingDocument.text}`;

  return [
    makeTrace({
      document: matchingDocument.fileName,
      excerpt: findBestExcerpt(sourceText, terms),
      confidence,
    }),
  ];
}

function detectVendors(documents: ParsedDocument[], text: string): VendorItem[] {
  return KNOWN_VENDORS.filter((vendor) =>
    vendor.aliases.some((alias) => text.includes(alias))
  ).map((vendor) => {
    const isCritical =
      vendor.category === 'Cloud' ||
      vendor.category === 'Payments' ||
      vendor.category === 'Identity';

    const hasRiskTerms =
      text.includes('missing') ||
      text.includes('not documented') ||
      text.includes('cross-border') ||
      text.includes('not validated') ||
      text.includes('exit strategy');

    const risk: Severity =
      vendor.category === 'AI' || (isCritical && hasRiskTerms)
        ? 'Medium'
        : hasRiskTerms
          ? 'Medium'
          : 'Low';

    return {
      name: vendor.name,
      service: vendor.service,
      criticality: isCritical ? 'Critical' : 'Important',
      risk,
      score: risk === 'Medium' ? 74 : 88,
      country: vendor.exposure === 'US' ? 'US' : 'Unknown',
      spend: 'Unknown',
      category: vendor.category,
      exposure: vendor.exposure,
      dependency: isCritical ? 'Critical' : 'High',
      dataType:
        vendor.category === 'Cloud'
          ? 'Application and infrastructure data'
          : vendor.category === 'Payments'
            ? 'Payment data'
            : vendor.category === 'AI'
              ? 'Prompt and contextual data'
              : vendor.category === 'Identity'
                ? 'Identity data'
                : 'Business data',
      trace: findTraceForTerms(documents, [vendor.name, ...vendor.aliases], 0.82),
    };
  });
}

function detectEvidence(documents: ParsedDocument[], text: string): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];

  for (const document of documents) {
    const documentText = `${document.fileName} ${document.text}`.toLowerCase();

    let type: string | null = null;
    let terms: string[] = [];

    if (documentText.includes('soc 2') || documentText.includes('soc2')) {
      type = 'SOC Report';
      terms = ['soc 2', 'soc2'];
    } else if (documentText.includes('iso 27001') || documentText.includes('iso27001')) {
      type = 'Certificate';
      terms = ['iso 27001', 'iso27001'];
    } else if (documentText.includes('data processing agreement') || documentText.includes('dpa')) {
      type = 'DPA';
      terms = ['data processing agreement', 'dpa'];
    } else if (documentText.includes('business continuity') || documentText.includes('bcp')) {
      type = 'Business Continuity';
      terms = ['business continuity', 'bcp'];
    } else if (documentText.includes('exit strategy') || documentText.includes('exit plan')) {
      type = 'Exit Strategy';
      terms = ['exit strategy', 'exit plan'];
    } else if (documentText.includes('vendor register') || documentText.includes('third-party register')) {
      type = 'Register';
      terms = ['vendor register', 'third-party register'];
    } else if (documentText.includes('risk assessment')) {
      type = 'Risk Assessment';
      terms = ['risk assessment'];
    } else if (documentText.includes('agreement') || documentText.includes('contract')) {
      type = 'Contract';
      terms = ['agreement', 'contract'];
    }

    if (!type) {
      continue;
    }

    const status: EvidenceItem['status'] =
      documentText.includes('missing') ||
      documentText.includes('unsigned') ||
      documentText.includes('not documented') ||
      documentText.includes('does not include') ||
      documentText.includes('no validated')
        ? 'Missing'
        : 'Valid';

    evidence.push({
      name: document.fileName,
      vendor: 'Multiple / Unknown',
      type,
      status,
      expires: status === 'Missing' ? '—' : 'Review required',
      trace: [
        makeTrace({
          document: document.fileName,
          excerpt: findBestExcerpt(`${document.fileName}\n${document.text}`, terms.length > 0 ? terms : [type]),
          confidence: 0.82,
        }),
      ],
    });
  }

  const expected = [
    { present: evidence.some((item) => item.type === 'Contract'), name: 'Vendor contracts', type: 'Contract' },
    { present: evidence.some((item) => item.type === 'SOC Report'), name: 'SOC 2 reports', type: 'SOC Report' },
    { present: evidence.some((item) => item.type === 'Certificate'), name: 'ISO 27001 certificates', type: 'Certificate' },
    { present: evidence.some((item) => item.type === 'Business Continuity'), name: 'Business continuity plan', type: 'Business Continuity' },
    { present: evidence.some((item) => item.type === 'Exit Strategy'), name: 'Exit strategy documentation', type: 'Exit Strategy' },
    { present: evidence.some((item) => item.type === 'DPA'), name: 'Data processing agreements', type: 'DPA' },
  ];

  expected.forEach((item) => {
    if (!item.present) {
      evidence.push({
        name: item.name,
        vendor: 'Multiple / Unknown',
        type: item.type,
        status: 'Missing',
        expires: '—',
        trace: [],
      });
    }
  });

  return evidence;
}

function detectGaps(
  text: string,
  vendors: VendorItem[],
  evidence: EvidenceItem[],
  documents: ParsedDocument[]
): Finding[] {
  const gaps: Finding[] = [];

  const hasCloud = vendors.some((vendor) => vendor.category === 'Cloud');
  const hasAI = vendors.some((vendor) => vendor.category === 'AI');
  const hasUS = vendors.some((vendor) => vendor.exposure === 'US');
  const missingExit = evidence.some((item) => item.type === 'Exit Strategy' && item.status === 'Missing');
  const missingBcp = evidence.some((item) => item.type === 'Business Continuity' && item.status === 'Missing');

  if (hasCloud && missingExit) {
    gaps.push({
      title: 'Cloud Exit Strategy Not Validated',
      severity: 'High',
      vendor: vendors.find((vendor) => vendor.category === 'Cloud')?.name ?? 'Cloud provider',
      category: 'DORA',
      article: 'DORA',
      rec: 'Document and test a provider exit strategy, including data portability, substitutability, recovery timelines, and ownership.',
      trace: findTraceForTerms(
        documents,
        ['exit strategy', 'exit plan', 'not documented', 'no validated', 'does not include', 'migration plan'],
        0.84
      ),
    });
  }

  if (hasCloud) {
    gaps.push({
      title: 'Cloud Concentration Risk Detected',
      severity: 'High',
      vendor: vendors.find((vendor) => vendor.category === 'Cloud')?.name ?? 'Cloud provider',
      category: 'Digital Sovereignty',
      article: 'Concentration',
      rec: 'Assess substitutability and document mitigation for critical cloud dependency.',
      trace: findTraceForTerms(documents, ['primary cloud', 'production workloads', 'aws', 'azure', 'cloud infrastructure'], 0.8),
    });
  }

  if (hasAI) {
    gaps.push({
      title: 'AI Supplier Governance Review Required',
      severity: 'Medium',
      vendor: vendors.find((vendor) => vendor.category === 'AI')?.name ?? 'AI provider',
      category: 'AI Act',
      article: 'AI Inventory',
      rec: 'Create an AI supplier inventory covering models, use cases, data inputs, risk classification, and human oversight responsibilities.',
      trace: findTraceForTerms(documents, ['ai inventory', 'model inventory', 'human oversight', 'risk classification', 'openai'], 0.8),
    });
  }

  if (hasUS || text.includes('cross-border') || text.includes('united states')) {
    gaps.push({
      title: 'Customer Data Processed Outside EU',
      severity: 'High',
      vendor: 'Multiple US providers',
      category: 'Data Residency',
      article: 'Residency',
      rec: 'Confirm processing regions and document cross-border transfer safeguards for regulated, personal, or sensitive data.',
      trace: findTraceForTerms(documents, ['united states', 'cross-border', 'non-eu', 'global support', 'us provider'], 0.82),
    });
  }

  if (missingBcp) {
    gaps.push({
      title: 'Business Continuity Evidence Missing',
      severity: 'Medium',
      vendor: 'Multiple providers',
      category: 'Operational Resilience',
      article: 'Resilience',
      rec: 'Collect and validate business continuity and disaster recovery evidence for critical suppliers.',
      trace: findTraceForTerms(documents, ['business continuity', 'disaster recovery', 'bcp', 'missing'], 0.78),
    });
  }

  if (gaps.length === 0) {
    gaps.push({
      title: 'Vendor Dependency Analysis Completed',
      severity: 'Low',
      vendor: 'Multiple providers',
      category: 'DORA',
      article: 'Review',
      rec: 'Continue validating critical supplier evidence and ownership.',
      trace: documents[0]
        ? [
            makeTrace({
              document: documents[0].fileName,
              excerpt: documents[0].text,
              confidence: 0.55,
            }),
          ]
        : [],
    });
  }

  return gaps;
}

function createId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildExecutiveSummary(args: {
  documents: ParsedDocument[];
  vendors: VendorItem[];
  gaps: Finding[];
  evidence: EvidenceItem[];
  industry: string;
}) {
  const highGaps = args.gaps.filter((gap) => gap.severity === 'High');
  const missingEvidence = args.evidence.filter((item) => item.status === 'Missing');

  return {
    title: `${args.industry} vendor risk executive summary`,
    narrative: `Guara analysed ${args.documents.length} uploaded documents covering ${args.vendors.length} detected vendors. ${highGaps.length} high-priority findings and ${missingEvidence.length} missing evidence items were identified. The main priority is to close critical supplier evidence gaps and validate remediation ownership.`,
    keyPoints: [
      `${args.vendors.length} vendors detected across the uploaded package.`,
      `${highGaps.length} high-severity findings require priority review.`,
      `${missingEvidence.length} evidence items are missing or incomplete.`,
    ],
    materialRisks: args.gaps.slice(0, 5).map((gap) => gap.title),
    recommendedFocus: Array.from(new Set(args.gaps.map((gap) => gap.rec))).slice(0, 5),
  };
}

function buildRemediationPlans(gaps: Finding[]) {
  return gaps.map((gap) => ({
    id: `remediation-${createId(`${gap.title}-${gap.vendor}`)}`,
    findingTitle: gap.title,
    vendor: gap.vendor,
    category: gap.category,
    priority: gap.severity,
    owner:
      gap.category === 'DORA'
        ? 'Procurement'
        : gap.category === 'Data Residency'
          ? 'Data Protection'
          : gap.category === 'AI Act'
            ? 'Compliance'
            : gap.category === 'Operational Resilience'
              ? 'IT'
              : 'Risk',
    timeline: gap.severity === 'High' ? '30 days' : gap.severity === 'Medium' ? '60 days' : '90 days',
    status: 'Open',
    objective: gap.rec,
    actions: [
      'Assign accountable business and control owner.',
      'Collect or validate supporting evidence.',
      'Update vendor risk register and control documentation.',
      'Confirm completion through management review.',
    ],
    successCriteria: [
      'Evidence is attached and reviewable.',
      'Risk owner has approved the remediation outcome.',
      'Finding status can be re-assessed with source traceability.',
    ],
    relatedArticle: gap.article,
    trace: gap.trace ?? [],
  }));
}

function buildAnalysisResult(documents: ParsedDocument[]) {
  const text = getCombinedText(documents);
  const industry = detectIndustry(text);
  const vendors = detectVendors(documents, text);
  const evidence = detectEvidence(documents, text);
  const gaps = detectGaps(text, vendors, evidence, documents);

  const executiveSummary = buildExecutiveSummary({
    documents,
    vendors,
    gaps,
    evidence,
    industry,
  });

  const remediationPlans = buildRemediationPlans(gaps);

  const highFindingCount = gaps.filter((gap) => gap.severity === 'High').length;
  const missingEvidenceCount = evidence.filter((item) => item.status === 'Missing').length;
  const hasUS = vendors.some((vendor) => vendor.exposure === 'US');
  const cloudVendor = vendors.find((vendor) => vendor.category === 'Cloud');
  const criticalVendors = vendors.filter((vendor) => vendor.criticality === 'Critical').length;

  const readinessScore = Math.max(
    35,
    Math.min(
      94,
      82 - highFindingCount * 7 - missingEvidenceCount * 5 + (vendors.length > 0 ? 4 : 0)
    )
  );

  const cloudRisk = cloudVendor
    ? [
        {
          label: cloudVendor.name,
          pct: 85,
          spend: cloudVendor.spend,
        },
      ]
    : [];

  const dependencies = vendors
    .filter((vendor) => vendor.criticality === 'Critical')
    .slice(0, 6)
    .map((vendor) => ({
      vendor: vendor.name,
      service: vendor.service,
      impact:
        vendor.category === 'Cloud'
          ? 'Core application hosting, APIs, data processing, and operational services'
          : vendor.category === 'Payments'
            ? 'Payment acceptance, settlement, refunds, and disputes'
            : vendor.category === 'Identity'
              ? 'Authentication, privileged access, and workforce identity'
              : 'Critical business workflow dependency',
      icon:
        vendor.category === 'Cloud'
          ? 'cloud'
          : vendor.category === 'Payments'
            ? 'payments'
            : vendor.category === 'Identity'
              ? 'identity'
              : 'data',
    }));

  const mainRisk =
    gaps[0]?.rec ??
    'Critical technology dependencies require validation and evidence collection.';

  const headlineFinding =
    gaps[0]?.title ??
    'Vendor dependency analysis completed.';

  return {
    source: 'upload',
    generatedAt: new Date().toISOString(),
    scenario: {
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
      criticalVendors,
      readinessScore,
      mainRisk,
      headlineFinding,
      regionExposure: hasUS ? 'US provider dependency detected' : 'No major non-EU exposure detected',
    },
    executiveSummary,
    documents: documents.map((document) => ({
      name: document.fileName,
      size: `${(document.size / 1024 / 1024).toFixed(2)} MB`,
      type: document.extension.toUpperCase() || 'Document',
      icon: getDocumentIcon(document.extension),
    })),
    vendors,
    gaps,
    evidence,
    cloudRisk,
    sovereigntyScores: {
      cloud: cloudVendor ? 35 : 82,
      data: hasUS ? 55 : 78,
      ai: vendors.some((vendor) => vendor.category === 'AI') ? 62 : 82,
      concentration: cloudVendor ? 35 : 82,
      regulatory: Math.max(45, 82 - highFindingCount * 6),
    },
    dependencies,
    outageSimulation: {
      provider: cloudVendor?.name ?? 'Primary technology provider',
      affectedDependencies: Math.max(criticalVendors, dependencies.length),
      affectedServices:
        dependencies.length > 0
          ? dependencies.map((dependency) => dependency.service)
          : ['Customer portal', 'Data processing', 'Internal operations'],
      impact: criticalVendors >= 3 ? 'Severe' : cloudVendor ? 'High' : 'Medium',
      recovery: criticalVendors >= 3
        ? '10–20 days without validated contingency plan'
        : '5–10 days depending on backup provider readiness',
      recommendation: 'Define exit options and test service recovery for critical technology dependencies.',
    },
    remediationPlans,
    boardRisks: [
      mainRisk,
      ...gaps.slice(0, 3).map((gap) => gap.title),
    ],
    auditItems: [
      { label: 'Technology Dependency Map', pages: 8, type: 'Board Pack' },
      { label: 'Critical Supplier Register', pages: 6, type: 'Register' },
      { label: 'Gap & Risk Analysis Report', pages: 14, type: 'Risk Report' },
      { label: 'Evidence Inventory', pages: 7, type: 'Evidence' },
      { label: 'Concentration Risk Assessment', pages: 6, type: 'Risk Report' },
      { label: 'Remediation Action Plan', pages: 9, type: 'Action Plan' },
    ],
    auditRecommendations: Array.from(new Set(gaps.map((gap) => gap.rec))).slice(0, 5),
  };
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  response.setHeader('Content-Type', 'application/json');

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const files = flattenFormidableFiles(await parseForm(request));

    if (files.length === 0) {
      response.status(400).json({ error: 'No files were uploaded.' });
      return;
    }

    const parsedDocuments: ParsedDocument[] = [];
    const skippedFiles: string[] = [];

    for (const file of files) {
      const originalName = file.originalFilename ?? file.newFilename;
      const extension = getExtension(originalName);

      if (!isSupportedExtension(extension)) {
        skippedFiles.push(originalName);
        continue;
      }

      const buffer = await fs.readFile(file.filepath);

      if (extension === 'zip') {
        const zipDocuments = await extractZip(buffer, originalName);
        parsedDocuments.push(...zipDocuments);
      } else {
        parsedDocuments.push(await extractText(originalName, extension, buffer));
      }
    }

    if (parsedDocuments.length === 0) {
      response.status(400).json({
        error:
          'No supported files were found. Please upload PDF, DOCX, XLSX, CSV, ZIP, TXT, MD, or JSON files.',
        skippedFiles,
      });
      return;
    }

    const analysisResult = buildAnalysisResult(parsedDocuments);

    response.status(200).json(analysisResult);
  } catch (error) {
    response.status(500).json({
      error: getErrorMessage(error),
      details:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
    });
  }
}
