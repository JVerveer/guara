import type { ParsedDocument } from '../ingestion/types';
import type { Vendor } from '../types';

type KnownVendor = {
  aliases: string[];
  name: string;
  service: string;
  category: NonNullable<Vendor['category']>;
  country: string;
  exposure: NonNullable<Vendor['exposure']>;
  dataType: string;
};

const KNOWN_VENDORS: KnownVendor[] = [
  {
    aliases: ['aws', 'amazon web services'],
    name: 'AWS',
    service: 'Cloud Infrastructure',
    category: 'Cloud',
    country: 'US',
    exposure: 'US',
    dataType: 'Production workloads',
  },
  {
    aliases: ['microsoft azure', 'azure'],
    name: 'Microsoft Azure',
    service: 'Cloud Services',
    category: 'Cloud',
    country: 'US',
    exposure: 'US',
    dataType: 'Infrastructure data',
  },
  {
    aliases: ['google cloud platform', 'gcp'],
    name: 'Google Cloud Platform',
    service: 'Cloud Infrastructure',
    category: 'Cloud',
    country: 'US',
    exposure: 'US',
    dataType: 'Application and platform data',
  },
  {
    aliases: ['stripe'],
    name: 'Stripe',
    service: 'Payment Processing',
    category: 'Payments',
    country: 'US',
    exposure: 'US',
    dataType: 'Payment data',
  },
  {
    aliases: ['openai'],
    name: 'OpenAI',
    service: 'AI Services',
    category: 'AI',
    country: 'US',
    exposure: 'US',
    dataType: 'Prompt and support data',
  },
  {
    aliases: ['snowflake'],
    name: 'Snowflake',
    service: 'Data Warehousing',
    category: 'Data',
    country: 'US',
    exposure: 'US',
    dataType: 'Analytics data',
  },
  {
    aliases: ['okta'],
    name: 'Okta',
    service: 'Identity & Access',
    category: 'Identity',
    country: 'US',
    exposure: 'US',
    dataType: 'Identity data',
  },
  {
    aliases: ['auth0'],
    name: 'Auth0',
    service: 'Identity Management',
    category: 'Identity',
    country: 'US',
    exposure: 'US',
    dataType: 'Identity data',
  },
  {
    aliases: ['twilio'],
    name: 'Twilio',
    service: 'Communications API',
    category: 'SaaS',
    country: 'US',
    exposure: 'US',
    dataType: 'Communications data',
  },
  {
    aliases: ['datadog'],
    name: 'Datadog',
    service: 'Monitoring & Observability',
    category: 'Monitoring',
    country: 'US',
    exposure: 'US',
    dataType: 'Telemetry data',
  },
  {
    aliases: ['salesforce'],
    name: 'Salesforce',
    service: 'CRM Platform',
    category: 'SaaS',
    country: 'US',
    exposure: 'US',
    dataType: 'Customer records',
  },
  {
    aliases: ['guidewire'],
    name: 'Guidewire',
    service: 'Policy Administration',
    category: 'SaaS',
    country: 'US',
    exposure: 'US',
    dataType: 'Policy and claims data',
  },
  {
    aliases: ['mulesoft'],
    name: 'MuleSoft',
    service: 'Integration Platform',
    category: 'SaaS',
    country: 'US',
    exposure: 'US',
    dataType: 'Integration payloads',
  },
  {
    aliases: ['mongodb atlas', 'mongodb'],
    name: 'MongoDB Atlas',
    service: 'Managed Database',
    category: 'Data',
    country: 'US',
    exposure: 'US',
    dataType: 'Application database records',
  },
  {
    aliases: ['zendesk'],
    name: 'Zendesk',
    service: 'Support Desk',
    category: 'SaaS',
    country: 'US',
    exposure: 'US',
    dataType: 'Support ticket data',
  },
  {
    aliases: ['docusign'],
    name: 'DocuSign',
    service: 'E-signature',
    category: 'SaaS',
    country: 'US',
    exposure: 'US',
    dataType: 'Signed documents',
  },
];

function includesAny(haystack: string, aliases: string[]) {
  return aliases.some((alias) => haystack.includes(alias));
}

function inferCriticality(text: string, vendorName: string): Vendor['criticality'] {
  const vendorContext = text
    .split('\n')
    .filter((line) => line.toLowerCase().includes(vendorName.toLowerCase()))
    .join(' ')
    .toLowerCase();

  if (
    vendorContext.includes('critical') ||
    vendorContext.includes('critical or important') ||
    vendorContext.includes('production') ||
    vendorContext.includes('primary')
  ) {
    return 'Critical';
  }

  if (
    vendorContext.includes('important') ||
    vendorContext.includes('high')
  ) {
    return 'Important';
  }

  return 'Standard';
}

function inferRisk(text: string, vendorName: string): Vendor['risk'] {
  const lower = text.toLowerCase();

  const riskyTerms = [
    'not documented',
    'missing',
    'not completed',
    'no tested',
    'not validated',
    'cross-border',
    'united states',
    'us provider',
  ];

  const vendorMentioned = lower.includes(vendorName.toLowerCase());

  if (vendorMentioned && riskyTerms.some((term) => lower.includes(term))) {
    return 'High';
  }

  if (vendorMentioned && (lower.includes('partial') || lower.includes('draft'))) {
    return 'Medium';
  }

  return 'Low';
}

function scoreFromRisk(risk: Vendor['risk']) {
  if (risk === 'High') return 58;
  if (risk === 'Medium') return 74;
  return 88;
}

export function detectVendors(documents: ParsedDocument[]): Vendor[] {
  const combinedText = documents
    .map((doc) => `${doc.fileName}\n${doc.text}`)
    .join('\n')
    .toLowerCase();

  return KNOWN_VENDORS
    .filter((vendor) => includesAny(combinedText, vendor.aliases))
    .map((vendor) => {
      const criticality = inferCriticality(combinedText, vendor.name);
      const risk = inferRisk(combinedText, vendor.name);

      return {
        name: vendor.name,
        service: vendor.service,
        criticality,
        risk,
        score: scoreFromRisk(risk),
        country: vendor.country,
        spend: 'Unknown',
        category: vendor.category,
        exposure: vendor.exposure,
        dependency:
          criticality === 'Critical'
            ? 'Critical'
            : criticality === 'Important'
              ? 'High'
              : 'Medium',
        dataType: vendor.dataType,
        trace: [],
      };
    });
}
