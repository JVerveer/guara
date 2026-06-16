import type { EvidenceItem, Finding, Vendor } from '../types';
import type { AnalysisFacts } from '../facts/types';

export type RiskScoreInput = {
  vendor: Vendor;
  facts: AnalysisFacts;
  evidence: EvidenceItem[];
  gaps: Finding[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function criticalityPenalty(vendor: Vendor) {
  if (vendor.criticality === 'Critical') return 14;
  if (vendor.criticality === 'Important') return 8;
  if (vendor.criticality === 'Standard') return 3;
  return 0;
}

function exposurePenalty(vendor: Vendor) {
  if (vendor.exposure === 'US') return 10;
  if (vendor.exposure === 'Global') return 6;
  return 0;
}

function categoryPenalty(vendor: Vendor) {
  if (vendor.category === 'Cloud') return 12;
  if (vendor.category === 'AI') return 10;
  if (vendor.category === 'Payments') return 8;
  if (vendor.category === 'Identity') return 7;
  if (vendor.category === 'Data') return 7;
  return 3;
}

function missingEvidencePenalty(vendor: Vendor, evidence: EvidenceItem[]) {
  const vendorEvidence = evidence.filter(
    (item) =>
      item.vendor === vendor.name ||
      item.vendor === 'Multiple / Unknown' ||
      item.vendor === 'Multiple providers'
  );

  const missingCount = vendorEvidence.filter((item) => item.status === 'Missing').length;
  const expiringCount = vendorEvidence.filter((item) => item.status === 'Expiring').length;

  return missingCount * 5 + expiringCount * 2;
}

function findingPenalty(vendor: Vendor, gaps: Finding[]) {
  const relatedGaps = gaps.filter(
    (gap) =>
      gap.vendor === vendor.name ||
      gap.vendor === 'Multiple providers' ||
      gap.vendor === 'Multiple US providers' ||
      gap.vendor === 'Cloud provider'
  );

  return relatedGaps.reduce((sum, gap) => {
    if (gap.severity === 'High') return sum + 9;
    if (gap.severity === 'Medium') return sum + 5;
    return sum + 2;
  }, 0);
}

function concentrationPenalty(vendor: Vendor, facts: AnalysisFacts) {
  if (vendor.category !== 'Cloud') return 0;

  const cloudDependencies = facts.dependencies.filter(
    (dependency) => dependency.dependencyType === 'Cloud'
  );

  if (cloudDependencies.length === 1) return 10;
  if (cloudDependencies.length === 2) return 5;

  return 2;
}

export function calculateVendorRiskScore(input: RiskScoreInput) {
  const { vendor, facts, evidence, gaps } = input;

  const score =
    100 -
    criticalityPenalty(vendor) -
    exposurePenalty(vendor) -
    categoryPenalty(vendor) -
    missingEvidencePenalty(vendor, evidence) -
    findingPenalty(vendor, gaps) -
    concentrationPenalty(vendor, facts);

  return clampScore(score);
}

export function riskLevelFromScore(score: number): Vendor['risk'] {
  if (score < 65) return 'High';
  if (score < 82) return 'Medium';
  return 'Low';
}

export function applyVendorScoring(args: {
  vendors: Vendor[];
  facts: AnalysisFacts;
  evidence: EvidenceItem[];
  gaps: Finding[];
}): Vendor[] {
  return args.vendors.map((vendor) => {
    const score = calculateVendorRiskScore({
      vendor,
      facts: args.facts,
      evidence: args.evidence,
      gaps: args.gaps,
    });

    return {
      ...vendor,
      score,
      risk: riskLevelFromScore(score),
    };
  });
}

export function calculateReadinessScoreFromEvidenceAndFindings(args: {
  vendors: Vendor[];
  evidence: EvidenceItem[];
  gaps: Finding[];
}) {
  const highFindings = args.gaps.filter((gap) => gap.severity === 'High').length;
  const mediumFindings = args.gaps.filter((gap) => gap.severity === 'Medium').length;
  const missingEvidence = args.evidence.filter((item) => item.status === 'Missing').length;
  const criticalVendors = args.vendors.filter((vendor) => vendor.criticality === 'Critical').length;

  const score =
    92 -
    highFindings * 7 -
    mediumFindings * 3 -
    missingEvidence * 4 -
    Math.max(0, criticalVendors - 2) * 2;

  return clampScore(Math.max(35, Math.min(94, score)));
}
