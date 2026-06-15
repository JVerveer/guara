import type { ExtractedPackageFile, ParsedDocument } from '../ingestion/types';
import { extractCsv } from './extractCsv';
import { extractDocx } from './extractDocx';
import { extractPdf } from './extractPdf';
import { extractTxt } from './extractTxt';

export async function extractTextFromFile(
  extractedFile: ExtractedPackageFile
): Promise<ParsedDocument> {
  const { file, extension } = extractedFile;

  let text = '';

  if (extension === 'csv') {
    text = await extractCsv(file);
  } else if (extension === 'txt' || extension === 'md') {
    text = await extractTxt(file);
  } else if (extension === 'pdf') {
    text = await extractPdf(file);
  } else if (extension === 'docx') {
    text = await extractDocx(file);
  } else if (extension === 'json') {
    text = await extractTxt(file);
  } else {
    text = `Unsupported file type uploaded: ${extractedFile.name}`;
  }

  return {
    fileName: extractedFile.name,
    extension: extractedFile.extension,
    text,
    size: extractedFile.size,
  };
}

export async function extractTextFromFiles(
  files: ExtractedPackageFile[]
): Promise<ParsedDocument[]> {
  return Promise.all(files.map(extractTextFromFile));
}
