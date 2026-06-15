import type { KnownVendor } from './types';

export const KNOWN_VENDORS: KnownVendor[] = [
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
];
