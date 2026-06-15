import type {
  ClassifiedDocument,
  DocumentType,
} from './types';

function detectDocumentType(text: string): DocumentType {
  const content = text.toLowerCase();

  if (content.includes('soc 2')) {
    return 'SOC2';
  }

  if (
    content.includes('iso 27001') ||
    content.includes('iso27001')
  ) {
    return 'ISO27001';
  }

  if (
    content.includes('business continuity') ||
    content.includes('disaster recovery')
  ) {
    return 'BCP';
  }

  if (
    content.includes('exit plan') ||
    content.includes('termination assistance')
  ) {
    return 'ExitPlan';
  }

  if (
    content.includes('data processing agreement') ||
    content.includes('processor')
  ) {
    return 'DPA';
  }

  if (
    content.includes('questionnaire') ||
    content.includes('security questionnaire')
  ) {
    return 'Questionnaire';
  }

  if (
    content.includes('vendor register') ||
    content.includes('third-party register')
  ) {
    return 'Register';
  }

  if (
    content.includes('agreement') ||
    content.includes('master services')
  ) {
    return 'Contract';
  }

  return 'Unknown';
}

export function classifyDocuments(
  documents: {
    fileName: string;
    text: string;
  }[]
): ClassifiedDocument[] {
  return documents.map((document) => ({
    fileName: document.fileName,
    documentType: detectDocumentType(document.text),
    confidence: 0.8,
  }));
}