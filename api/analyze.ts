import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import fs from 'node:fs/promises';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

import { buildAnalysisResultFromDocuments } from '../src/analysis/builders/buildAnalysisResult';
import type { ParsedDocument } from '../src/analysis/ingestion/types';

export const config = {
  api: {
    bodyParser: false,
  },
};

const SUPPORTED_EXTENSIONS = [
  'pdf',
  'docx',
  'xlsx',
  'xls',
  'csv',
  'zip',
  'txt',
  'md',
  'json',
];

function getExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function isSupportedExtension(extension: string) {
  return SUPPORTED_EXTENSIONS.includes(extension);
}

function isHiddenOrSystemFile(fileName: string) {
  return (
    fileName.startsWith('__MACOSX/') ||
    fileName.includes('/.') ||
    fileName.startsWith('.') ||
    fileName.endsWith('.DS_Store')
  );
}

async function parseForm(request: VercelRequest) {
  const form = formidable({
    multiples: true,
    keepExtensions: true,
  });

  return new Promise<formidable.Files>((resolve, reject) => {
    form.parse(request, (error, _fields, files) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(files);
    });
  });
}

function flattenFormidableFiles(files: formidable.Files) {
  return Object.values(files)
    .flat()
    .filter(Boolean) as formidable.File[];
}

async function extractZip(buffer: Buffer, sourceName: string): Promise<ParsedDocument[]> {
  const zip = await JSZip.loadAsync(buffer);
  const docs: ParsedDocument[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || isHiddenOrSystemFile(path)) continue;

    const extension = getExtension(path);
    if (!isSupportedExtension(extension) || extension === 'zip') continue;

    const fileBuffer = await entry.async('nodebuffer');
    const fileName = path.split('/').pop() ?? path;

    docs.push(await extractText(fileName, extension, fileBuffer));
  }

  if (docs.length === 0) {
    throw new Error(`No supported documents found inside ${sourceName}.`);
  }

  return docs;
}

async function extractText(
  fileName: string,
  extension: string,
  buffer: Buffer
): Promise<ParsedDocument> {
  let text = '';

  if (extension === 'pdf') {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    text = result.text;
    await parser.destroy();
  } else if (extension === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else if (extension === 'xlsx' || extension === 'xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    text = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);

      return `Sheet: ${sheetName}\n${csv}`;
    }).join('\n\n');
  } else if (
    extension === 'csv' ||
    extension === 'txt' ||
    extension === 'md' ||
    extension === 'json'
  ) {
    text = buffer.toString('utf8');
  }

  return {
    fileName,
    extension,
    text: text.trim(),
    size: buffer.length,
  };
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const files = flattenFormidableFiles(await parseForm(request));

    if (files.length === 0) {
      response.status(400).json({ error: 'No files were uploaded.' });
      return;
    }

    const parsedDocuments: ParsedDocument[] = [];

    for (const file of files) {
      const originalName = file.originalFilename ?? file.newFilename;
      const extension = getExtension(originalName);

      if (!isSupportedExtension(extension)) continue;

      const buffer = await fs.readFile(file.filepath);

      if (extension === 'zip') {
        parsedDocuments.push(...(await extractZip(buffer, originalName)));
      } else {
        parsedDocuments.push(await extractText(originalName, extension, buffer));
      }
    }

    if (parsedDocuments.length === 0) {
      response.status(400).json({
        error:
          'No supported files were found. Please upload PDF, DOCX, XLSX, CSV, ZIP, TXT, MD, or JSON files.',
      });
      return;
    }

    const analysisResult = buildAnalysisResultFromDocuments(parsedDocuments);

    response.status(200).json(analysisResult);
  } catch (error) {
    console.error('[api/analyze] Error:', error);

    response.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Failed to analyze uploaded documents.',
    });
  }
}