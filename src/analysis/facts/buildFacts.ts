import type { ParsedDocument } from '../ingestion/types';
import type { AnalysisFacts } from './types';
import { extractContractFacts } from './extractContractFacts';
import { extractDependencyFacts } from './extractDependencyFacts';
import { extractEvidenceFacts } from './extractEvidenceFacts';
import { extractResidencyFacts } from './extractResidencyFacts';
import { extractVendorFacts } from './extractVendorFacts';

export function buildFacts(documents: ParsedDocument[]): AnalysisFacts {
  const vendors = extractVendorFacts(documents);
  const evidence = extractEvidenceFacts(documents);
  const dependencies = extractDependencyFacts(documents, vendors);
  const residency = extractResidencyFacts(documents, vendors);
  const contracts = extractContractFacts(documents);

  return {
    vendors,
    evidence,
    dependencies,
    residency,
    contracts,
  };
}
