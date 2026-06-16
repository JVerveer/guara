import type { ParsedDocument } from '../ingestion/types';
import type { ContractFact } from './types';
import { createFactId, findBestExcerpt, includesAny, makeSource } from './factUtils';

type ClausePattern = {
  clauseType: ContractFact['clauseType'];
  terms: string[];
};

const CLAUSE_PATTERNS: ClausePattern[] = [
  {
    clauseType: 'AuditRights',
    terms: ['right to audit', 'audit rights', 'audit access'],
  },
  {
    clauseType: 'ExitAssistance',
    terms: [
      'exit assistance',
      'termination assistance',
      'transition assistance',
      'data portability',
      'exit strategy',
      'exit plan',
      'tested migration',
      'migration plan',
      'substitutability',
    ],
  },
  {
    clauseType: 'Termination',
    terms: ['termination', 'terminate', 'termination for cause'],
  },
  {
    clauseType: 'Subprocessor',
    terms: ['subprocessor', 'sub-processor', 'subcontractor'],
  },
  {
    clauseType: 'DataLocation',
    terms: ['data location', 'processing location', 'data residency', 'cross-border'],
  },
  {
    clauseType: 'BusinessContinuity',
    terms: [
      'business continuity',
      'disaster recovery',
      'recovery time objective',
      'rto',
      'rpo',
      'outage simulation',
      'provider outage',
    ],
  },
  {
    clauseType: 'Security',
    terms: ['security controls', 'information security', 'encryption', 'access controls'],
  },
];

function cleanExcerpt(excerpt: string) {
  const normalized = excerpt.replace(/\s+/g, ' ').trim();

  const firstSentenceStart = normalized.search(/[A-Z][^.!?]{10,}/);

  if (firstSentenceStart > 0 && firstSentenceStart < 80) {
    return normalized.slice(firstSentenceStart).trim();
  }

  return normalized;
}

function detectVendorName(text: string) {
  const vendors = [
    'AWS',
    'Amazon Web Services',
    'Microsoft Azure',
    'Azure',
    'Google Cloud Platform',
    'Google Cloud',
    'Stripe',
    'OpenAI',
    'Snowflake',
    'Okta',
    'Salesforce',
    'Twilio',
    'Datadog',
  ];

  const lower = text.toLowerCase();
  const vendor = vendors.find((item) => lower.includes(item.toLowerCase()));

  if (vendor === 'Amazon Web Services') return 'AWS';
  if (vendor === 'Azure') return 'Microsoft Azure';
  if (vendor === 'Google Cloud') return 'Google Cloud Platform';

  return vendor;
}

function confidenceForClause(clauseType: ContractFact['clauseType']) {
  if (clauseType === 'ExitAssistance') return 0.82;
  if (clauseType === 'BusinessContinuity') return 0.8;
  return 0.78;
}

export function extractContractFacts(documents: ParsedDocument[]): ContractFact[] {
  const facts: ContractFact[] = [];

  documents.forEach((document) => {
    const text = `${document.fileName}\n${document.text}`;
    const lower = text.toLowerCase();

    CLAUSE_PATTERNS.forEach((pattern) => {
      if (!includesAny(lower, pattern.terms)) {
        return;
      }

      const rawExcerpt = findBestExcerpt(text, pattern.terms);
      const excerpt = cleanExcerpt(rawExcerpt);

      facts.push({
        id: createFactId('contract', [pattern.clauseType, document.fileName]),
        type: 'contract',
        vendorName: detectVendorName(text),
        clauseType: pattern.clauseType,
        source: makeSource({
          document: document.fileName,
          excerpt,
          confidence: confidenceForClause(pattern.clauseType),
        }),
      });
    });
  });

  return facts;
}