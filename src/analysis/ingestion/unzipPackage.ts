import JSZip from 'jszip';
import type { ExtractedPackageFile } from './types';

function getExtension(fileName: string) {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() ?? '' : '';
}

function isHiddenOrSystemFile(fileName: string) {
  return (
    fileName.startsWith('__MACOSX/') ||
    fileName.includes('/.') ||
    fileName.startsWith('.') ||
    fileName.endsWith('.DS_Store')
  );
}

export async function unzipPackage(file: File): Promise<ExtractedPackageFile[]> {
  const extension = getExtension(file.name);

  if (extension !== 'zip') {
    return [
      {
        name: file.name,
        extension,
        mimeType: file.type,
        size: file.size,
        file,
      },
    ];
  }

  const zip = await JSZip.loadAsync(file);
  const extracted: ExtractedPackageFile[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || isHiddenOrSystemFile(path)) {
      continue;
    }

    const blob = await entry.async('blob');
    const name = path.split('/').pop() ?? path;
    const extractedFile = new File([blob], name, {
      type: blob.type || 'application/octet-stream',
    });

    extracted.push({
      name,
      extension: getExtension(name),
      mimeType: extractedFile.type,
      size: extractedFile.size,
      file: extractedFile,
    });
  }

  return extracted;
}

export async function unpackUploadedFiles(files: File[]): Promise<ExtractedPackageFile[]> {
  const extracted = await Promise.all(files.map((file) => unzipPackage(file)));

  return extracted.flat();
}
