import type { AnalysisResult } from './types';
import { buildAnalysisResultFromDocuments } from './builders/buildAnalysisResult';
import { extractTextFromFiles } from './extractors/extractText';
import { unpackUploadedFiles } from './ingestion/unzipPackage';

export async function analyzeUploadedPackage(files: File[]): Promise<AnalysisResult> {
  const extractedFiles = await unpackUploadedFiles(files);
  const parsedDocuments = await extractTextFromFiles(extractedFiles);

  return buildAnalysisResultFromDocuments(parsedDocuments);
}
