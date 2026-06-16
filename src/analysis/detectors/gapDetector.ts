import type { Finding, Vendor } from '../types';
import type { ParsedDocument } from '../ingestion/types';

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term.toLowerCase()));
}

function addUnique(findings: Finding[], finding: Finding) {
  const exists = findings.some(
    (item) => item.title === finding.title && item.vendor === finding.vendor
  );

  if (!exists) {
    findings.push(finding);
  }
}

export function detectGaps(documents: ParsedDocument[], vendors: Vendor[]): Finding[] {
  const text = documents
    .map((doc) => `${doc.fileName}\n${doc.text}`)
    .join('\n')
    .toLowerCase();

  const findings: Finding[] = [];

  const hasCloudProvider = vendors.some((vendor) => vendor.category === 'Cloud');
  const hasAiProvider = vendors.some((vendor) => vendor.category === 'AI');
  const hasUsExposure = vendors.some((vendor) => vendor.exposure === 'US');

  if (
    hasCloudProvider &&
    containsAny(text, [
      'exit strategy not validated',
      'no tested migration',
      'not include a tested',
      'not documented',
      'exit strategy is missing',
      'no validated',
    ])
  ) {
    const cloudVendor = vendors.find((vendor) => vendor.category === 'Cloud');

    addUnique(findings, {
      title: 'Cloud Exit Strategy Not Validated',
      severity: 'High',
      vendor: cloudVendor?.name ?? 'Cloud provider',
      category: 'DORA',
      article: 'Art. 28(3)(e)',
      rec: 'Document and test a provider exit strategy, including data portability, substitutability, recovery timelines, and ownership.',
      trace: [],
    });
  }

  if (
    hasCloudProvider &&
    containsAny(text, [
      'primary cloud',
      'primary deployment',
      'primary application hosting',
      'secondary cloud: none',
      'concentration',
      'provider-level outage',
      'regional outage',
    ])
  ) {
    const cloudVendor = vendors.find((vendor) => vendor.category === 'Cloud');

    addUnique(findings, {
      title: 'Hyperscaler Dependency Exceeds Tolerance',
      severity: 'High',
      vendor: cloudVendor?.name ?? 'Cloud provider',
      category: 'Digital Sovereignty',
      article: 'Concentration',
      rec: 'Assess substitutability and document mitigation for critical cloud dependency, including failover, portability, and strategic concentration risk.',
      trace: [],
    });
  }

  if (
    hasAiProvider &&
    containsAny(text, [
      'ai inventory',
      'model inventory',
      'human oversight',
      'risk classification',
      'ai governance',
      'prototype',
      'not complete',
      'missing',
    ])
  ) {
    const aiVendor = vendors.find((vendor) => vendor.category === 'AI');

    addUnique(findings, {
      title: 'AI Supplier Not Fully Inventoried',
      severity: 'Medium',
      vendor: aiVendor?.name ?? 'AI provider',
      category: 'AI Act',
      article: 'AI Inventory',
      rec: 'Create an AI supplier inventory covering models, use cases, data inputs, risk classification, and human oversight responsibilities.',
      trace: [],
    });
  }

  if (
    hasUsExposure &&
    containsAny(text, [
      'cross-border',
      'united states',
      'us provider',
      'global support',
      'subprocessors global',
      'non-eu',
      'us/eu mixed',
    ])
  ) {
    addUnique(findings, {
      title: 'Customer Data Processed Outside EU',
      severity: 'High',
      vendor: 'Multiple US providers',
      category: 'Data Residency',
      article: 'Residency',
      rec: 'Confirm processing regions and document cross-border transfer safeguards for regulated, personal, or sensitive data.',
      trace: [],
    });
  }

  if (
    containsAny(text, [
      'no evidence of annual test',
      'not include a full',
      'outage simulation has not been performed',
      'provider outage simulation',
      'not validated',
      'manual downtime procedures',
    ])
  ) {
    addUnique(findings, {
      title: 'No Validated Recovery Scenario',
      severity: 'Medium',
      vendor: 'Critical technology provider',
      category: 'Operational Resilience',
      article: 'Resilience',
      rec: 'Run and document a provider outage simulation for services supported by critical technology vendors.',
      trace: [],
    });
  }

  if (
    containsAny(text, [
      'soc 2 report',
      'complete report is available',
      'not included',
      'not attached',
      'missing',
    ])
  ) {
    addUnique(findings, {
      title: 'Missing or Incomplete Assurance Evidence',
      severity: 'Medium',
      vendor: 'Multiple providers',
      category: 'DORA',
      article: 'Art. 28(2)',
      rec: 'Collect current SOC 2, ISO 27001, business continuity, and subprocessor evidence for critical and important suppliers.',
      trace: [],
    });
  }

  return findings;
}