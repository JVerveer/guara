import type { EvidenceItem, FindingTrace, Vendor } from '../types';
import type { AnalysisFacts, FactSource } from '../facts/types';

function sourceToTrace(source: FactSource): FindingTrace {
  return {
    document: source.document,
    excerpt: source.excerpt,
    page: source.page,
    chunkId: source.chunkId,
    confidence: source.confidence,
  };
}

function normalizeVendorName(name?: string) {
  if (!name) return '';
  const value = name.toLowerCase();

  if (value === 'amazon web services') return 'aws';
  if (value === 'azure') return 'microsoft azure';
  if (value === 'google cloud') return 'google cloud platform';

  return value;
}

function evidenceTypeLabel(type: string) {
  if (type === 'SOC2') return 'SOC Report';
  if (type === 'ISO27001') return 'Certificate';
  if (type === 'BCP') return 'Business Continuity';
  if (type === 'ExitPlan') return 'Exit Strategy';
  if (type === 'AIPolicy') return 'AI Governance';
  if (type === 'SubprocessorDisclosure') return 'Subprocessor Disclosure';
  if (type === 'RiskAssessment') return 'Risk Assessment';

  return type;
}

export function attachVendorTrace(vendors: Vendor[], facts: AnalysisFacts): Vendor[] {
  return vendors.map((vendor) => {
    const vendorKey = normalizeVendorName(vendor.name);

    const trace = facts.vendors
      .filter((fact) => normalizeVendorName(fact.vendorName) === vendorKey)
      .map((fact) => sourceToTrace(fact.source));

    return {
      ...vendor,
      trace,
    } as Vendor;
  });
}

export function buildEvidenceItemsFromFacts(facts: AnalysisFacts): EvidenceItem[] {
  return facts.evidence.map((fact) => ({
    name: fact.source.document,
    vendor: fact.vendorName ?? 'Multiple / Unknown',
    type: evidenceTypeLabel(fact.evidenceType),
    status: fact.status ?? 'Valid',
    expires: fact.status === 'Missing' ? '—' : fact.expiresAt ?? 'Review required',
    trace: [sourceToTrace(fact.source)],
  })) as EvidenceItem[];
}

export function attachEvidenceTrace(evidence: EvidenceItem[], facts: AnalysisFacts): EvidenceItem[] {
  return evidence.map((item) => {
    const matchingFacts = facts.evidence.filter((fact) => {
      const sameDocument = fact.source.document === item.name;
      const sameType = evidenceTypeLabel(fact.evidenceType) === item.type;
      const sameVendor =
        normalizeVendorName(fact.vendorName) === normalizeVendorName(item.vendor) ||
        item.vendor === 'Multiple / Unknown' ||
        !fact.vendorName;

      return sameDocument && sameType && sameVendor;
    });

    const trace = matchingFacts.map((fact) => sourceToTrace(fact.source));

    return {
      ...item,
      trace,
    } as EvidenceItem;
  });
}
