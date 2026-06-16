import type { ParsedDocument } from '../ingestion/types';
import type { DependencyFact, VendorFact } from './types';
import { createFactId, findBestExcerpt, includesAny, makeSource } from './factUtils';

function dependencyTypeFromCategory(category: VendorFact['category']): DependencyFact['dependencyType'] {
  if (category === 'Cloud') return 'Cloud';
  if (category === 'Payments') return 'Payments';
  if (category === 'Identity') return 'Identity';
  if (category === 'Data') return 'Data';
  if (category === 'AI') return 'AI';
  if (category === 'Monitoring') return 'Monitoring';

  return 'SaaS';
}

function inferCriticality(text: string): DependencyFact['criticality'] {
  const lower = text.toLowerCase();

  if (includesAny(lower, ['critical', 'production', 'primary', 'core service', 'critical or important'])) {
    return 'Critical';
  }

  if (includesAny(lower, ['important', 'high impact', 'material'])) {
    return 'Important';
  }

  return 'Standard';
}

function inferBusinessImpact(category: VendorFact['category']) {
  if (category === 'Cloud') return 'Core application hosting, APIs, data processing, and operational services';
  if (category === 'Payments') return 'Payment acceptance, settlement, refunds, and disputes';
  if (category === 'Identity') return 'Authentication, privileged access, and workforce identity';
  if (category === 'Data') return 'Analytics, reporting, and data processing';
  if (category === 'AI') return 'AI-enabled workflows, prompts, model outputs, and contextual data';
  if (category === 'Monitoring') return 'Monitoring, observability, incident detection, and telemetry';

  return 'Critical business workflow dependency';
}

export function extractDependencyFacts(
  documents: ParsedDocument[],
  vendorFacts: VendorFact[]
): DependencyFact[] {
  const factsByKey = new Map<string, DependencyFact>();

  vendorFacts.forEach((vendorFact) => {
    const sourceDocument = documents.find((document) => document.fileName === vendorFact.source.document);
    const combinedText = `${sourceDocument?.fileName ?? vendorFact.source.document}\n${sourceDocument?.text ?? vendorFact.source.excerpt}`;

    const excerpt = findBestExcerpt(combinedText, [
      vendorFact.vendorName,
      'critical',
      'production',
      'primary',
      'dependency',
      'service',
    ]);

    const key = `${vendorFact.vendorName}-${vendorFact.source.document}`;

    factsByKey.set(key, {
      id: createFactId('dependency', [vendorFact.vendorName, vendorFact.source.document]),
      type: 'dependency',
      vendorName: vendorFact.vendorName,
      dependencyType: dependencyTypeFromCategory(vendorFact.category),
      service: vendorFact.service,
      businessImpact: inferBusinessImpact(vendorFact.category),
      criticality: inferCriticality(combinedText),
      source: makeSource({
        document: vendorFact.source.document,
        excerpt,
        confidence: vendorFact.source.confidence,
      }),
    });
  });

  return Array.from(factsByKey.values());
}
