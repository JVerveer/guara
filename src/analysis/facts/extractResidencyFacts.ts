import type { ParsedDocument } from '../ingestion/types';
import type { DataResidencyFact, VendorFact } from './types';
import { createFactId, findBestExcerpt, includesAny, makeSource } from './factUtils';

function inferRegion(text: string): DataResidencyFact['region'] | null {
  const lower = text.toLowerCase();

  if (includesAny(lower, ['united states', 'us provider', 'u.s.', 'usa', 'non-eu', 'cross-border'])) {
    return 'US';
  }

  if (includesAny(lower, ['european union', 'eu region', 'eu processing', 'eea'])) {
    return 'EU';
  }

  if (includesAny(lower, ['global support', 'global subprocessors', 'global processing'])) {
    return 'Global';
  }

  return null;
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

export function extractResidencyFacts(
  documents: ParsedDocument[],
  vendorFacts: VendorFact[]
): DataResidencyFact[] {
  const facts: DataResidencyFact[] = [];

  documents.forEach((document) => {
    const text = `${document.fileName}\n${document.text}`;
    const region = inferRegion(text);

    if (!region) {
      return;
    }

    facts.push({
      id: createFactId('residency', [region, document.fileName]),
      type: 'dataResidency',
      region,
      source: makeSource({
        document: document.fileName,
        excerpt: findBestExcerpt(text, ['united states', 'non-eu', 'cross-border', 'global support', 'eu processing']),
        confidence: 0.82,
      }),
    });
  });

  vendorFacts.forEach((vendor) => {
    const region = defaultRegionFromVendor(vendor);

    if (region === 'Unknown') {
      return;
    }

    facts.push({
      id: createFactId('residency', [vendor.vendorName, region, vendor.source.document]),
      type: 'dataResidency',
      vendorName: vendor.vendorName,
      region,
      dataType:
        vendor.category === 'AI'
          ? 'Prompt and contextual data'
          : vendor.category === 'Cloud'
            ? 'Application and infrastructure data'
            : vendor.category === 'Payments'
              ? 'Payment data'
              : vendor.category === 'Identity'
                ? 'Identity data'
                : 'Business data',
      source: vendor.source,
    });
  });

  return facts;
}
