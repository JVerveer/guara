import JSZip from 'jszip';

import { getExtension, isHiddenOrSystemFile, isSupportedExtension } from './fileRules';
import { extractText } from './extractText';
import type { ParsedDocument } from './types';

export async function extractZip(
  buffer: Buffer,
  sourceName: string
): Promise<ParsedDocument[]> {
  const zip = await JSZip.loadAsync(buffer);
  const docs: ParsedDocument[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || isHiddenOrSystemFile(path)) {
      continue;
    }

    const extension = getExtension(path);

    if (!isSupportedExtension(extension) || extension === 'zip') {
      continue;
    }

    const fileBuffer = await entry.async('nodebuffer');
    const fileName = path.split('/').pop() ?? path;

    docs.push(await extractText(fileName, extension, fileBuffer));
  }

  if (docs.length === 0) {
    throw new Error(`No supported documents found inside ${sourceName}.`);
  }

  return docs;
}
