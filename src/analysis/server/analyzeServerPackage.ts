import { buildAnalysisResultFromDocuments } from '../builders/buildAnalysisResult';
import type { AnalysisResult } from '../types';
import { adaptServerParsedDocuments } from './adaptParsedDocuments';
import { extractUploadedPackageFiles } from './extractPackage';
import { extractTextFromServerFiles } from './extractText';

export async function analyzeServerPackage(
  uploadedFiles: File[]
): Promise<AnalysisResult> {
  const extractedFiles = await extractUploadedPackageFiles(uploadedFiles);
  const serverParsedDocuments = await extractTextFromServerFiles(extractedFiles);
  const parsedDocuments = adaptServerParsedDocuments(serverParsedDocuments);

  return buildAnalysisResultFromDocuments(parsedDocuments);
}
