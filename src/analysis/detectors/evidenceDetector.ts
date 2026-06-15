import type { EvidenceItem } from '../types';
import type { ParsedDocument } from '../ingestion/types';

function detectType(fileName: string, text: string) {
  const value = `${fileName} ${text}`.toLowerCase();

  if (value.includes('soc 2') || value.includes('soc2')) return 'SOC Report';
  if (value.includes('iso 27001') || value.includes('iso27001')) return 'Certificate';
  if (value.includes('dpa') || value.includes('data processing agreement')) return 'DPA';
  if (value.includes('business continuity') || value.includes('bcp')) return 'Business Continuity';
  if (value.includes('exit strategy')) return 'Exit Strategy';
  if (value.includes('vendor register')) return 'Register';
  if (value.includes('risk assessment')) return 'Risk Assessment';
  if (value.includes('subprocessor')) return 'Subprocessor Disclosure';
  if (value.includes('ai governance') || value.includes('ai policy')) return 'AI Governance';

  return 'Document';
}

function detectVendor(fileName: string, text: string) {
  const value = `${fileName} ${text}`.toLowerCase();

  const vendors = [
    'AWS',
    'Microsoft Azure',
    'Google Cloud Platform',
    'Stripe',
    'OpenAI',
    'Snowflake',
    'Okta',
    'Auth0',
    'Twilio',
    'Datadog',
    'Salesforce',
    'Guidewire',
    'MuleSoft',
    'MongoDB Atlas',
    'Zendesk',
    'DocuSign',
  ];

  return vendors.find((vendor) => value.includes(vendor.toLowerCase())) ?? 'Multiple / Unknown';
}

function detectStatus(fileName: string, text: string): EvidenceItem['status'] {
  const value = `${fileName} ${text}`.toLowerCase();

  if (
    value.includes('missing') ||
    value.includes('not attached') ||
    value.includes('not documented') ||
    value.includes('unsigned')
  ) {
    return 'Missing';
  }

  if (
    value.includes('expiring') ||
    value.includes('expires') ||
    value.includes('2025-07') ||
    value.includes('2025-08')
  ) {
    return 'Expiring';
  }

  return 'Valid';
}

export function detectEvidence(documents: ParsedDocument[]): EvidenceItem[] {
  return documents
    .filter((doc) => {
      const value = `${doc.fileName} ${doc.text}`.toLowerCase();

      return [
        'soc',
        'iso',
        'dpa',
        'data processing',
        'business continuity',
        'bcp',
        'exit strategy',
        'register',
        'risk assessment',
        'subprocessor',
        'policy',
        'certificate',
      ].some((term) => value.includes(term));
    })
    .map((doc) => ({
      name: doc.fileName,
      vendor: detectVendor(doc.fileName, doc.text),
      type: detectType(doc.fileName, doc.text),
      status: detectStatus(doc.fileName, doc.text),
      expires: detectStatus(doc.fileName, doc.text) === 'Missing' ? '—' : 'Review required',
    }));
}
