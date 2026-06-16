import type { ParsedDocument } from '../ingestion/types';
import type { EvidenceFact } from './types';
import { createFactId, findBestExcerpt, includesAny, makeSource } from './factUtils';

type EvidencePattern = {
  evidenceType: EvidenceFact['evidenceType'];
  terms: string[];
};

const EVIDENCE_PATTERNS: EvidencePattern[] = [
  { evidenceType: 'SOC2', terms: ['soc 2', 'soc2', 'type ii report', 'type 2 report'] },
  { evidenceType: 'ISO27001', terms: ['iso 27001', 'iso27001', 'iso/iec 27001'] },
  { evidenceType: 'DPA', terms: ['data processing agreement', 'dpa'] },
  { evidenceType: 'BCP', terms: ['business continuity', 'bcp', 'disaster recovery'] },
  { evidenceType: 'ExitPlan', terms: ['exit plan', 'exit strategy', 'termination assistance', 'substitutability'] },
  { evidenceType: 'Questionnaire', terms: ['questionnaire', 'security questionnaire'] },
  { evidenceType: 'Register', terms: ['vendor register', 'third-party register', 'ict register'] },
  { evidenceType: 'Policy', terms: ['policy'] },
  { evidenceType: 'AIPolicy', terms: ['ai governance', 'ai policy', 'model governance'] },
  { evidenceType: 'SubprocessorDisclosure', terms: ['subprocessor', 'sub-processor', 'subcontractor'] },
  { evidenceType: 'RiskAssessment', terms: ['risk assessment', 'vendor assessment'] },
  { evidenceType: 'Contract', terms: ['agreement', 'master services', 'contract'] },
];

function detectStatus(text: string): EvidenceFact['status'] {
  const lower = text.toLowerCase();

  if (
    includesAny(lower, [
      'missing',
      'not attached',
      'not documented',
      'unsigned',
      'not included',
      'does not include',
      'no validated',
      'no evidence',
      'has not been performed',
    ])
  ) {
    return 'Missing';
  }

  if (includesAny(lower, ['expiring', 'expires', 'expiry', 'expiration'])) {
    return 'Expiring';
  }

  return 'Valid';
}

function detectVendorName(text: string) {
  const vendors = [
    'AWS',
    'Microsoft Azure',
    'Google Cloud Platform',
    'Stripe',
    'OpenAI',
    'Snowflake',
    'Okta',
    'Auth0',
    'Salesforce',
    'Twilio',
    'Datadog',
    'MongoDB Atlas',
    'Zendesk',
    'DocuSign',
    'Guidewire',
    'MuleSoft',
  ];

  const lower = text.toLowerCase();

  return vendors.find((vendor) => lower.includes(vendor.toLowerCase()));
}

export function extractEvidenceFacts(documents: ParsedDocument[]): EvidenceFact[] {
  const facts: EvidenceFact[] = [];

  documents.forEach((document) => {
    const text = `${document.fileName}\n${document.text}`;
    const lower = text.toLowerCase();

    EVIDENCE_PATTERNS.forEach((pattern) => {
      if (!includesAny(lower, pattern.terms)) {
        return;
      }

      const excerpt = findBestExcerpt(text, pattern.terms);

      facts.push({
        id: createFactId('evidence', [pattern.evidenceType, document.fileName]),
        type: 'evidence',
        evidenceType: pattern.evidenceType,
        vendorName: detectVendorName(text),
        status: detectStatus(text),
        source: makeSource({
          document: document.fileName,
          excerpt,
          confidence: pattern.evidenceType === 'Contract' ? 0.68 : 0.82,
        }),
      });
    });
  });

  return facts;
}
