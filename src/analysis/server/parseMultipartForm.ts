import type { VercelRequest } from '@vercel/node';
import formidable, {
  type File as FormidableFile,
  type Files,
} from 'formidable';

export async function parseMultipartForm(request: VercelRequest): Promise<Files> {
  const form = formidable({
    multiples: true,
    keepExtensions: true,
    maxFileSize: 25 * 1024 * 1024,
    maxTotalFileSize: 50 * 1024 * 1024,
  });

  return new Promise((resolve, reject) => {
    form.parse(request, (error, _fields, files) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(files);
    });
  });
}

export function flattenFormidableFiles(files: Files): FormidableFile[] {
  return Object.values(files)
    .flat()
    .filter(Boolean) as FormidableFile[];
}
