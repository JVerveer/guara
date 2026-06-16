import type { ParsedDocument } from '../ingestion/types';
import type { DataResidencyFact, VendorFact } from './types';
import { createFactId, findBestExcerpt, includesAny, makeSource } from './factUtils';

const US_REGION_TERMS = [
  'united states',
  'us provider',
  'u.s.',
  'usa',
  'non-eu',
  'cross-border',
  'outside the eu',
  'outside eu',
  'us/eu mixed',
];

const EU_REGION_TERMS = [
  'european union',
  'eu region',
  'eu processing',
  'eea',
  'eu-only',
  'eu data residency',
];

const GLOBAL_REGION_TERMS = [
  'global support',
  'global subprocessors',
  'global processing',
  'worldwide support',
];

function cleanExcerpt(excerpt: string) {
  const normalized = excerpt.replace(/\s+/g, ' ').trim();
  const firstSentenceStart = normalized.search(/[A-Z][^.!?]{10,}/);

  if (firstSentenceStart > 0 && firstSentenceStart < 80) {
    return normalized.slice(firstSentenceStart).trim();
  }

  return normalized;
}

function inferRegion(text: string): DataResidencyFact['region'] | null {
  const lower = text.toLowerCase();

  if (includesAny(lower, US_REGION_TERMS)) {
    return 'US';
  }

  if (includesAny(lower, EU_REGION_TERMS)) {
    return 'EU';
  }

  if (includesAny(lower, GLOBAL_REGION_TERMS)) {
    return 'Global';
  }

  return null;
}

function regionTerms(region: DataResidencyFact['region']) {
  if (region === 'US') return US_REGION_TERMS;
  if (region === 'EU') return EU_REGION_TERMS;
  if (region === 'Global') return GLOBAL_REGION_TERMS;

  return [];
}

function defaultRegionFromVendor(vendor: VendorFact): DataResidencyFact['region'] {
  if (
    vendor.category === 'Cloud' ||
    vendor.category === 'AI' ||
    ['Stripe', 'Snowflake', 'Okta', 'Salesforce', 'Twilio', 'Datadog'].includes(vendor.vendorName)
  ) {
    return 'US';
  }

  return 'Unknown';
}

function dataTypeFromVendor(vendor: VendorFact) {
  if (vendor.category === 'AI') return 'Prompt and contextual data';
  if (vendor.category === 'Cloud') return 'Application and infrastructure data';
  if (vendor.category === 'Payments') return 'Payment data';
  if (vendor.category === 'Identity') return 'Identity data';
  if (vendor.category === 'Monitoring') return 'Telemetry data';
  if (vendor.category === 'Data') return 'Analytics and reporting data';

  return 'Business data';
}

export function extractResidencyFacts(
  documents: ParsedDocument[],
  vendorFacts: VendorFact[]
): DataResidencyFact[] {
  const factsByKey = new Map<string, DataResidencyFact>();

  documents.forEach((document) => {
    const text = `${document.fileName}\n${document.text}`;
    const region = inferRegion(text);

    if (!region) {
      return;
    }

    const rawExcerpt = findBestExcerpt(text, regionTerms(region));
    const excerpt = cleanExcerpt(rawExcerpt);
    const key = `${region}-${document.fileName}`;

    factsByKey.set(key, {
      id: createFactId('residency', [region, document.fileName]),
      type: 'dataResidency',
      region,
      source: makeSource({
        document: document.fileName,
        excerpt,
        confidence: 0.84,
      }),
    });
  });

  vendorFacts.forEach((vendor) => {
    const region = defaultRegionFromVendor(vendor);

    if (region === 'Unknown') {
      return;
    }

    const key = `${vendor.vendorName}-${region}-${vendor.source.document}`;

    if (factsByKey.has(key)) {
      return;
    }

    factsByKey.set(key, {
      id: createFactId('residency', [vendor.vendorName, region, vendor.source.document]),
      type: 'dataResidency',
      vendorName: vendor.vendorName,
      region,
      dataType: dataTypeFromVendor(vendor),
      source: {
        ...vendor.source,
        confidence: Math.min(vendor.source.confidence, 0.78),
      },
    });
  });

  return Array.from(factsByKey.values());
}