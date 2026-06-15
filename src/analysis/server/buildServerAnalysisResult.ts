import { getDocumentIcon } from './fileRules';
import { KNOWN_VENDORS } from './vendorRules';
import type { ParsedDocument, Severity } from './types';

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

function detectVendors(text: string) {
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
    };
  });
}

function detectEvidence(documents: ParsedDocument[]) {
  const evidence = [];

  for (const document of documents) {
    const documentText = `${document.fileName} ${document.text}`.toLowerCase();

    let type: string | null = null;

    if (documentText.includes('soc 2') || documentText.includes('soc2')) type = 'SOC Report';
    else if (documentText.includes('iso 27001') || documentText.includes('iso27001')) type = 'Certificate';
    else if (documentText.includes('data processing agreement') || documentText.includes('dpa')) type = 'DPA';
    else if (documentText.includes('business continuity') || documentText.includes('bcp')) type = 'Business Continuity';
    else if (documentText.includes('exit strategy') || documentText.includes('exit plan')) type = 'Exit Strategy';
    else if (documentText.includes('vendor register') || documentText.includes('third-party register')) type = 'Register';
    else if (documentText.includes('risk assessment')) type = 'Risk Assessment';
    else if (documentText.includes('agreement') || documentText.includes('contract')) type = 'Contract';

    if (!type) {
      continue;
    }

    evidence.push({
      name: document.fileName,
      vendor: 'Multiple / Unknown',
      type,
      status:
        documentText.includes('missing') ||
        documentText.includes('unsigned') ||
        documentText.includes('not documented')
          ? 'Missing'
          : 'Valid',
      expires: 'Review required',
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
      });
    }
  });

  return evidence;
}

function detectGaps(
  text: string,
  vendors: ReturnType<typeof detectVendors>,
  evidence: ReturnType<typeof detectEvidence>
) {
  const gaps = [];

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
    });
  }

  return gaps;
}

export function buildServerAnalysisResult(documents: ParsedDocument[]) {
  const text = getCombinedText(documents);
  const industry = detectIndustry(text);
  const vendors = detectVendors(text);
  const evidence = detectEvidence(documents);
  const gaps = detectGaps(text, vendors, evidence);

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
