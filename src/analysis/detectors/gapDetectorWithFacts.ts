import type { Finding } from '../types';
import type { AnalysisFacts, FindingTrace } from '../facts/types';

type TraceSource = {
  document: string;
  excerpt: string;
  page?: number;
  chunkId?: string;
  confidence: number;
};

function toTrace(source?: TraceSource): FindingTrace[] {
  if (!source) return [];

  return [
    {
      document: source.document,
      excerpt: source.excerpt,
      page: source.page,
      chunkId: source.chunkId,
      confidence: source.confidence,
    },
  ];
}

function addUnique(findings: Finding[], finding: Finding) {
  const exists = findings.some(
    (item) => item.title === finding.title && item.vendor === finding.vendor
  );

  if (!exists) {
    findings.push(finding);
  }
}

function includesAny(value: string, terms: string[]) {
  const lower = value.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

function isNegativeEvidence(value: string) {
  return includesAny(value, [
    'missing',
    'does not include',
    'not documented',
    'no validated',
    'no evidence',
    'not attached',
    'not included',
    'has not been performed',
  ]);
}

function hasValidEvidence(value: string) {
  return !isNegativeEvidence(value);
}

function findBestExitPlanTraceSource(facts: AnalysisFacts): TraceSource | undefined {
  const missingExitPlanEvidence = facts.evidence.find(
    (item) => item.evidenceType === 'ExitPlan' && item.status === 'Missing'
  );

  if (missingExitPlanEvidence) {
    return missingExitPlanEvidence.source;
  }

  const negativeExitPlanEvidence = facts.evidence.find(
    (item) =>
      item.evidenceType === 'ExitPlan' &&
      isNegativeEvidence(item.source.excerpt)
  );

  if (negativeExitPlanEvidence) {
    return negativeExitPlanEvidence.source;
  }

  const exitPlanContractGap = facts.contracts.find((item) => {
    const excerpt = item.source.excerpt.toLowerCase();

    return (
      item.clauseType === 'ExitAssistance' &&
      isNegativeEvidence(excerpt)
    );
  });

  if (exitPlanContractGap) {
    return exitPlanContractGap.source;
  }

  const anyNegativeExitMention = [...facts.evidence, ...facts.contracts].find((item) =>
    includesAny(item.source.excerpt, ['exit strategy', 'exit plan', 'termination assistance']) &&
    isNegativeEvidence(item.source.excerpt)
  );

  if (anyNegativeExitMention) {
    return anyNegativeExitMention.source;
  }

  const cloudDependency = facts.dependencies.find(
    (dependency) => dependency.dependencyType === 'Cloud'
  );

  return cloudDependency?.source;
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
      hasValidEvidence(item.source.excerpt)
  );

  if (cloudDependencies.length > 0 && !exitPlanEvidence) {
    const traceSource = findBestExitPlanTraceSource(facts);

    addUnique(findings, {
      title: 'Cloud Exit Strategy Not Validated',
      severity: 'High',
      vendor: cloudDependencies[0]?.vendorName ?? 'Cloud provider',
      category: 'DORA',
      article: 'Art. 28(3)(e)',
      rec: 'Document and test a provider exit strategy, including data portability, substitutability, recovery timelines, and ownership.',
      trace: toTrace(traceSource),
    });
  }

  if (cloudDependencies.length === 1) {
    addUnique(findings, {
      title: 'Hyperscaler Dependency Exceeds Tolerance',
      severity: 'High',
      vendor: cloudDependencies[0].vendorName,
      category: 'Digital Sovereignty',
      article: 'Concentration',
      rec: 'Assess substitutability and document mitigation for critical cloud dependency, including failover, portability, and strategic concentration risk.',
      trace: toTrace(cloudDependencies[0].source),
    });
  }

  if (aiDependencies.length > 0) {
    addUnique(findings, {
      title: 'AI Supplier Governance Review Required',
      severity: 'Medium',
      vendor: aiDependencies[0].vendorName,
      category: 'AI Act',
      article: 'AI Inventory',
      rec: 'Create an AI supplier inventory covering models, use cases, data inputs, risk classification, and human oversight responsibilities.',
      trace: toTrace(aiDependencies[0].source),
    });
  }

  if (usResidency) {
    addUnique(findings, {
      title: 'Customer Data Processed Outside EU',
      severity: 'High',
      vendor: usResidency.vendorName ?? 'Multiple US providers',
      category: 'Data Residency',
      article: 'Residency',
      rec: 'Confirm processing regions and document cross-border transfer safeguards for regulated, personal, or sensitive data.',
      trace: toTrace(usResidency.source),
    });
  }

  const bcpEvidence = facts.evidence.find(
    (item) =>
      item.evidenceType === 'BCP' &&
      item.status === 'Valid' &&
      hasValidEvidence(item.source.excerpt)
  );

  if (!bcpEvidence) {
    const bcpTraceSource =
      facts.evidence.find(
        (item) =>
          item.evidenceType === 'BCP' &&
          isNegativeEvidence(item.source.excerpt)
      )?.source ?? cloudDependencies[0]?.source;

    addUnique(findings, {
      title: 'Business Continuity Evidence Missing',
      severity: 'Medium',
      vendor: 'Multiple providers',
      category: 'Operational Resilience',
      article: 'Resilience',
      rec: 'Collect and validate business continuity and disaster recovery evidence for critical suppliers.',
      trace: toTrace(bcpTraceSource),
    });
  }

  const assuranceEvidence = facts.evidence.filter(
    (item) =>
      (item.evidenceType === 'SOC2' || item.evidenceType === 'ISO27001') &&
      item.status === 'Valid' &&
      hasValidEvidence(item.source.excerpt)
  );

  if (assuranceEvidence.length === 0) {
    const assuranceTraceSource =
      facts.evidence.find(
        (item) =>
          (item.evidenceType === 'SOC2' || item.evidenceType === 'ISO27001') &&
          isNegativeEvidence(item.source.excerpt)
      )?.source ?? cloudDependencies[0]?.source;

    addUnique(findings, {
      title: 'Missing or Incomplete Assurance Evidence',
      severity: 'Medium',
      vendor: 'Multiple providers',
      category: 'DORA',
      article: 'Art. 28(2)',
      rec: 'Collect current SOC 2, ISO 27001, business continuity, and subprocessor evidence for critical and important suppliers.',
      trace: toTrace(assuranceTraceSource),
    });
  }

  return findings;
}