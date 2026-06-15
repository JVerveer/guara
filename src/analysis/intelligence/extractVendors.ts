import type { VendorDetection } from './types';

const KNOWN_VENDORS = [
  'AWS',
  'Amazon Web Services',
  'Microsoft Azure',
  'Azure',
  'Stripe',
  'Salesforce',
  'Datadog',
  'Snowflake',
  'OpenAI',
  'Okta',
  'Twilio',
  'Google Cloud',
];

export function extractVendors(
  documents: {
    text: string;
  }[]
): VendorDetection[] {
  const counts = new Map<string, number>();

  documents.forEach((document) => {
    const text = document.text.toLowerCase();

    KNOWN_VENDORS.forEach((vendor) => {
      const matches = (
        text.match(
          new RegExp(vendor.toLowerCase(), 'g')
        ) || []
      ).length;

      if (matches > 0) {
        counts.set(
          vendor,
          (counts.get(vendor) ?? 0) + matches
        );
      }
    });
  });

  return [...counts.entries()]
    .map(([name, occurrences]) => ({
      name,
      occurrences,
    }))
    .sort(
      (a, b) =>
        b.occurrences - a.occurrences
    );
}