import type {
  ClassifiedDocument,
  EvidenceCoverage,
} from './types';

export function detectEvidence(
  documents: ClassifiedDocument[]
): EvidenceCoverage {
  const hasType = (
    type: ClassifiedDocument['documentType']
  ) =>
    documents.some(
      (document) =>
        document.documentType === type
    );

  return {
    contracts: hasType('Contract'),
    soc2: hasType('SOC2'),
    iso27001: hasType('ISO27001'),
    bcp: hasType('BCP'),
    exitPlan: hasType('ExitPlan'),
    dpa: hasType('DPA'),
  };
}