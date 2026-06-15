import type { VercelRequest } from '@vercel/node';
import fs from 'node:fs/promises';

import { getExtension, isSupportedExtension } from './fileRules';
import { extractText } from './extractText';
import { extractZip } from './extractZip';
import {
  flattenFormidableFiles,
  parseMultipartForm,
} from './parseMultipartForm';
import type { ParsedDocument } from './types';

export async function extractUploadedDocuments(
  request: VercelRequest
): Promise<ParsedDocument[]> {
  const files = flattenFormidableFiles(await parseMultipartForm(request));

  if (files.length === 0) {
    throw new Error('No files were uploaded.');
  }

  const parsedDocuments: ParsedDocument[] = [];

  for (const file of files) {
    const originalName = file.originalFilename ?? file.newFilename;
    const extension = getExtension(originalName);

    if (!isSupportedExtension(extension)) {
      continue;
    }

    const buffer = await fs.readFile(file.filepath);

    if (extension === 'zip') {
      const zipDocuments = await extractZip(buffer, originalName);
      parsedDocuments.push(...zipDocuments);
    } else {
      parsedDocuments.push(await extractText(originalName, extension, buffer));
    }
  }

  if (parsedDocuments.length === 0) {
    throw new Error(
      'No supported files were found. Please upload PDF, DOCX, XLSX, CSV, ZIP, TXT, MD, or JSON files.'
    );
  }

  return parsedDocuments;
}
