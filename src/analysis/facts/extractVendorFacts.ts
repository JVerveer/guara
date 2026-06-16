import type { ParsedDocument } from '../ingestion/types';
import type { VendorFact } from './types';
import { createFactId, findBestExcerpt, includesAny, makeSource } from './factUtils';

type KnownVendor = {
  canonicalName: string;
  aliases: string[];
  category: NonNullable<VendorFact['category']>;
  service: string;
};

const KNOWN_VENDORS: KnownVendor[] = [
  { canonicalName: 'AWS', aliases: ['aws', 'amazon web services'], category: 'Cloud', service: 'Cloud Infrastructure' },
  { canonicalName: 'Microsoft Azure', aliases: ['microsoft azure', 'azure'], category: 'Cloud', service: 'Cloud Services' },
  { canonicalName: 'Google Cloud Platform', aliases: ['google cloud platform', 'google cloud', 'gcp'], category: 'Cloud', service: 'Cloud Infrastructure' },
  { canonicalName: 'Stripe', aliases: ['stripe'], category: 'Payments', service: 'Payment Processing' },
  { canonicalName: 'OpenAI', aliases: ['openai', 'gpt'], category: 'AI', service: 'AI Services' },
  { canonicalName: 'Snowflake', aliases: ['snowflake'], category: 'Data', service: 'Data Platform' },
  { canonicalName: 'Okta', aliases: ['okta'], category: 'Identity', service: 'Identity & Access' },
  { canonicalName: 'Auth0', aliases: ['auth0'], category: 'Identity', service: 'Identity Management' },
  { canonicalName: 'Salesforce', aliases: ['salesforce'], category: 'SaaS', service: 'CRM Platform' },
  { canonicalName: 'Twilio', aliases: ['twilio'], category: 'SaaS', service: 'Communications API' },
  { canonicalName: 'Datadog', aliases: ['datadog'], category: 'Monitoring', service: 'Monitoring & Observability' },
  { canonicalName: 'MongoDB Atlas', aliases: ['mongodb atlas', 'mongodb'], category: 'Data', service: 'Managed Database' },
  { canonicalName: 'Zendesk', aliases: ['zendesk'], category: 'SaaS', service: 'Support Desk' },
  { canonicalName: 'DocuSign', aliases: ['docusign'], category: 'SaaS', service: 'E-signature' },
  { canonicalName: 'Guidewire', aliases: ['guidewire'], category: 'SaaS', service: 'Policy Administration' },
  { canonicalName: 'MuleSoft', aliases: ['mulesoft'], category: 'SaaS', service: 'Integration Platform' },
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsAlias(text: string, alias: string) {
  const escaped = escapeRegExp(alias.toLowerCase());

  if (/^[a-z0-9 ]+$/i.test(alias)) {
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
  }

  return text.includes(alias.toLowerCase());
}

function cleanExcerpt(excerpt: string) {
  const normalized = excerpt.replace(/\s+/g, ' ').trim();
  const firstSentenceStart = normalized.search(/[A-Z][^.!?]{10,}/);

  if (firstSentenceStart > 0 && firstSentenceStart < 80) {
    return normalized.slice(firstSentenceStart).trim();
  }

  return normalized;
}

function scoreVendorDocument(document: ParsedDocument, vendor: KnownVendor, matchedAliases: string[]) {
  const value = `${document.fileName}\n${document.text}`.toLowerCase();

  let score = 0;

  score += matchedAliases.length * 4;

  if (includesAny(value, ['agreement', 'services', 'summary', 'contract'])) score += 4;
  if (includesAny(value, ['critical', 'production', 'primary', 'dependency'])) score += 4;
  if (includesAny(value, ['vendor inventory', 'vendor,service,criticality', 'register'])) score -= 2;

  if (vendor.category === 'Cloud' && includesAny(value, ['primary cloud', 'application hosting'])) {
    score += 3;
  }

  return score;
}

export function extractVendorFacts(documents: ParsedDocument[]): VendorFact[] {
  const bestFactByVendor = new Map<string, VendorFact>();

  KNOWN_VENDORS.forEach((vendor) => {
    let bestScore = -Infinity;
    let bestFact: VendorFact | null = null;

    documents.forEach((document) => {
      const text = `${document.fileName}\n${document.text}`;
      const lower = text.toLowerCase();

      const matchedAliases = vendor.aliases.filter((alias) => containsAlias(lower, alias));

      if (matchedAliases.length === 0) {
        return;
      }

      const rawExcerpt = findBestExcerpt(text, matchedAliases);
      const excerpt = cleanExcerpt(rawExcerpt);
      const score = scoreVendorDocument(document, vendor, matchedAliases);

      const fact: VendorFact = {
        id: createFactId('vendor', [vendor.canonicalName, document.fileName]),
        type: 'vendor',
        vendorName: vendor.canonicalName,
        aliases: matchedAliases,
        category: vendor.category,
        service: vendor.service,
        source: makeSource({
          document: document.fileName,
          excerpt,
          confidence: matchedAliases.length > 1 ? 0.9 : 0.8,
        }),
      };

      if (score > bestScore) {
        bestScore = score;
        bestFact = fact;
      }
    });

    if (bestFact) {
      bestFactByVendor.set(vendor.canonicalName, bestFact);
    }
  });

  return Array.from(bestFactByVendor.values());
}