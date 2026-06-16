import type { Finding } from '../types';
import type { AnalysisFacts, FindingTrace } from '../facts/types';

function toTrace(source?: {
  document: string;
  excerpt: string;
  page?: number;
  chunkId?: string;
  confidence: number;
}): FindingTrace[] {
  if (!source) return [];
  return [source];
}

function addUnique(findings: Finding[], finding: Finding) {
  const exists = findings.some(
    (item) => item.title === finding.title && item.vendor === finding.vendor
  );

  if (!exists) findings.push(finding);
}

export function detectGapsFromFacts(facts: AnalysisFacts): Finding[] {
  const findings: Finding[] = [];

  const cloudDependencies = facts.dependencies.filter(
    (dependency) => dependency.dependencyType === 'Cloud'
  );

  const aiDependencies = facts.dependencies.filter(
    (dependency) => dependency.dependencyType === 'AI'
  );

  const usResidency = facts.residency.find((item) => item.region === 'US');

  const exitPlanEvidence = facts.evidence.find(
    (item) =>
      item.evidenceType === 'ExitPlan' &&
      item.status === 'Valid' &&
      !item.source.excerpt.toLowerCase().includes('missing') &&
      !item.source.excerpt.toLowerCase().includes('does not include') &&
      !item.source.excerpt.toLowerCase().includes('not documented') &&
      !item.source.excerpt.toLowerCase().includes('no validated')
  );

  if (cloudDependencies.length > 0 && !exitPlanEvidence) {
    addUnique(findings, {
      title: 'Cloud Exit Strategy Not Validated',
      severity: 'High',
      vendor: cloudDependencies[0]?.vendorName ?? 'Cloud provider',
      category: 'DORA',
      article: 'Art. 28(3)(e)',
      rec: 'Document and test a provider exit strategy, including data portability, substitutability, recovery timelines, and ownership.',
      trace: toTrace(cloudDependencies[0]?.source),
    });
  }

  return findings;
}
