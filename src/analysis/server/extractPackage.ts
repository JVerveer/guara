import JSZip from 'jszip';
import type { ServerExtractedFile } from './types';
import {
  getExtension,
  isHiddenOrSystemFile,
  isSupportedExtension,
} from './fileUtils';

async function fileToBuffer(file: File) {
  const arrayBuffer = await file.arrayBuffer();

  return Buffer.from(arrayBuffer);
}

async function unzipBuffer(
  buffer: Buffer,
  sourceName: string
): Promise<ServerExtractedFile[]> {
  const zip = await JSZip.loadAsync(buffer);
  const files: ServerExtractedFile[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || isHiddenOrSystemFile(path)) {
      continue;
    }

    const extension = getExtension(path);

    if (!isSupportedExtension(extension)) {
      continue;
    }

    const content = await entry.async('nodebuffer');
    const name = path.split('/').pop() ?? path;

    files.push({
      name,
      extension,
      buffer: content,
      size: content.length,
    });
  }

  if (files.length === 0) {
    throw new Error(`No supported files found inside ${sourceName}.`);
  }

  return files;
}

export async function extractUploadedPackageFiles(
  uploadedFiles: File[]
): Promise<ServerExtractedFile[]> {
  const extracted: ServerExtractedFile[] = [];

  for (const file of uploadedFiles) {
    const extension = getExtension(file.name);

    if (!isSupportedExtension(extension)) {
      continue;
    }

    const buffer = await fileToBuffer(file);

    if (extension === 'zip') {
      const zipFiles = await unzipBuffer(buffer, file.name);
      extracted.push(...zipFiles);
      continue;
    }

    extracted.push({
      name: file.name,
      extension,
      buffer,
      size: file.size,
    });
  }

  if (extracted.length === 0) {
    throw new Error(
      'No supported files were uploaded. Please upload PDF, DOCX, XLSX, CSV, ZIP, TXT, MD, or JSON files.'
    );
  }

  return extracted;
}
