import type { ParsedDocument } from '../ingestion/types';
import type { VendorFact } from './types';
import { createFactId, findBestExcerpt, makeSource } from './factUtils';

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

export function extractVendorFacts(documents: ParsedDocument[]): VendorFact[] {
  const factsByKey = new Map<string, VendorFact>();

  documents.forEach((document) => {
    const text = `${document.fileName}\n${document.text}`;
    const lower = text.toLowerCase();

    KNOWN_VENDORS.forEach((vendor) => {
      const matchedAliases = vendor.aliases.filter((alias) => lower.includes(alias.toLowerCase()));

      if (matchedAliases.length === 0) {
        return;
      }

      const key = `${vendor.canonicalName}-${document.fileName}`;
      const excerpt = findBestExcerpt(text, matchedAliases);

      factsByKey.set(key, {
        id: createFactId('vendor', [vendor.canonicalName, document.fileName]),
        type: 'vendor',
        vendorName: vendor.canonicalName,
        aliases: matchedAliases,
        category: vendor.category,
        service: vendor.service,
        source: makeSource({
          document: document.fileName,
          excerpt,
          confidence: matchedAliases.length > 1 ? 0.9 : 0.78,
        }),
      });
    });
  });

  return Array.from(factsByKey.values());
}
