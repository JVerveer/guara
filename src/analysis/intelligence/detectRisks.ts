import type {
  EvidenceCoverage,
  RiskFinding,
  VendorDetection,
} from './types';

export function detectRisks(
  vendors: VendorDetection[],
  evidence: EvidenceCoverage
): RiskFinding[] {
  const findings: RiskFinding[] = [];

  if (!evidence.exitPlan) {
    findings.push({
      title:
        'No exit strategy documentation found',
      severity: 'High',
      category: 'DORA',
      recommendation:
        'Create and maintain documented exit plans for critical providers.',
    });
  }

  if (!evidence.bcp) {
    findings.push({
      title:
        'Business continuity evidence missing',
      severity: 'Medium',
      category: 'Operational Resilience',
      recommendation:
        'Document continuity and recovery procedures.',
    });
  }

  const cloudProviders = vendors.filter(
    (vendor) =>
      vendor.name.includes('AWS') ||
      vendor.name.includes('Azure') ||
      vendor.name.includes('Google Cloud')
  );

  if (cloudProviders.length === 1) {
    findings.push({
      title:
        'Single cloud provider dependency',
      severity: 'High',
      category: 'Digital Sovereignty',
      recommendation:
        'Assess substitutability and concentration risk.',
    });
  }

  const aiVendors = vendors.filter(
    (vendor) =>
      vendor.name.includes('OpenAI')
  );

  if (aiVendors.length > 0) {
    findings.push({
      title:
        'AI supplier governance review required',
      severity: 'Medium',
      category: 'AI Act',
      recommendation:
        'Maintain an inventory of AI systems and suppliers.',
    });
  }

  return findings;
}