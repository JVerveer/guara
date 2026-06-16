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

function cleanExcerpt(excerpt: string) {
  const normalized = excerpt.replace(/\s+/g, ' ').trim();

  const firstSentenceStart = normalized.search(/[A-Z][^.!?]{10,}/);

  if (firstSentenceStart > 0 && firstSentenceStart < 80) {
    return normalized.slice(firstSentenceStart).trim();
  }

  return normalized;
}

function scoreDocumentForDependency(document: ParsedDocument, vendorFact: VendorFact) {
  const value = `${document.fileName}\n${document.text}`.toLowerCase();
  const vendor = vendorFact.vendorName.toLowerCase();

  let score = 0;

  if (value.includes(vendor)) score += 5;
  if (vendorFact.aliases?.some((alias) => value.includes(alias.toLowerCase()))) score += 5;

  if (includesAny(value, ['agreement', 'services', 'summary', 'contract'])) score += 4;
  if (includesAny(value, ['critical', 'production', 'primary', 'dependency'])) score += 4;
  if (includesAny(value, ['vendor inventory', 'register'])) score -= 2;

  return score;
}

function findBestDependencyDocument(
  documents: ParsedDocument[],
  vendorFact: VendorFact
): ParsedDocument | undefined {
  return [...documents]
    .sort(
      (a, b) =>
        scoreDocumentForDependency(b, vendorFact) -
        scoreDocumentForDependency(a, vendorFact)
    )[0];
}

export function extractDependencyFacts(
  documents: ParsedDocument[],
  vendorFacts: VendorFact[]
): DependencyFact[] {
  const factsByKey = new Map<string, DependencyFact>();

  vendorFacts.forEach((vendorFact) => {
    const sourceDocument =
      findBestDependencyDocument(documents, vendorFact) ??
      documents.find((document) => document.fileName === vendorFact.source.document);

    const combinedText = `${
      sourceDocument?.fileName ?? vendorFact.source.document
    }\n${sourceDocument?.text ?? vendorFact.source.excerpt}`;

    const rawExcerpt = findBestExcerpt(combinedText, [
      vendorFact.vendorName,
      ...(vendorFact.aliases ?? []),
      'critical',
      'production',
      'primary',
      'dependency',
      'service',
    ]);

    const excerpt = cleanExcerpt(rawExcerpt);
    const sourceDocumentName = sourceDocument?.fileName ?? vendorFact.source.document;

    const key = `${vendorFact.vendorName}-${sourceDocumentName}`;

    factsByKey.set(key, {
      id: createFactId('dependency', [vendorFact.vendorName, sourceDocumentName]),
      type: 'dependency',
      vendorName: vendorFact.vendorName,
      dependencyType: dependencyTypeFromCategory(vendorFact.category),
      service: vendorFact.service,
      businessImpact: inferBusinessImpact(vendorFact.category),
      criticality: inferCriticality(combinedText),
      source: makeSource({
        document: sourceDocumentName,
        excerpt,
        confidence: Math.max(vendorFact.source.confidence, 0.82),
      }),
    });
  });

  return Array.from(factsByKey.values());
}