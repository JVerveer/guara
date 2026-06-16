import type { ParsedDocument } from '../ingestion/types';
import type { ContractFact } from './types';
import { createFactId, findBestExcerpt, includesAny, makeSource } from './factUtils';

type ClausePattern = {
  clauseType: ContractFact['clauseType'];
  terms: string[];
};

const CLAUSE_PATTERNS: ClausePattern[] = [
  { clauseType: 'AuditRights', terms: ['right to audit', 'audit rights', 'audit access'] },
  { clauseType: 'ExitAssistance', terms: ['exit assistance', 'termination assistance', 'transition assistance', 'data portability'] },
  { clauseType: 'Termination', terms: ['termination', 'terminate', 'termination for cause'] },
  { clauseType: 'Subprocessor', terms: ['subprocessor', 'sub-processor', 'subcontractor'] },
  { clauseType: 'DataLocation', terms: ['data location', 'processing location', 'data residency', 'cross-border'] },
  { clauseType: 'BusinessContinuity', terms: ['business continuity', 'disaster recovery', 'recovery time objective', 'rto', 'rpo'] },
  { clauseType: 'Security', terms: ['security controls', 'information security', 'encryption', 'access controls'] },
];

function detectVendorName(text: string) {
  const vendors = ['AWS', 'Microsoft Azure', 'Google Cloud Platform', 'Stripe', 'OpenAI', 'Snowflake', 'Okta', 'Salesforce', 'Twilio', 'Datadog'];
  const lower = text.toLowerCase();

  return vendors.find((vendor) => lower.includes(vendor.toLowerCase()));
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

      facts.push({
        id: createFactId('contract', [pattern.clauseType, document.fileName]),
        type: 'contract',
        vendorName: detectVendorName(text),
        clauseType: pattern.clauseType,
        source: makeSource({
          document: document.fileName,
          excerpt: findBestExcerpt(text, pattern.terms),
          confidence: 0.78,
        }),
      });
    });
  });

  return facts;
}
