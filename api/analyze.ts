import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable, {
  type File as FormidableFile,
  type Files,
} from 'formidable';
import fs from 'node:fs/promises';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { ZodError } from 'zod';

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
  return SUPPORTED_EXTENSIONS.includes(extension.toLowerCase());
}

function isHiddenOrSystemFile(fileName: string) {
  return (
    fileName.startsWith('__MACOSX/') ||
    fileName.includes('/.') ||
    fileName.startsWith('.') ||
    fileName.endsWith('.DS_Store')
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return `AnalysisResult validation failed: ${error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')}`;
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return 'Failed to analyze uploaded documents.';
}

async function parseForm(request: VercelRequest): Promise<Files> {
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

function flattenFormidableFiles(files: Files): FormidableFile[] {
  return Object.values(files)
    .flat()
    .filter(Boolean) as FormidableFile[];
}

async function extractZip(buffer: Buffer, sourceName: string): Promise<ParsedDocument[]> {
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

async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();

    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractText(
  fileName: string,
  extension: string,
  buffer: Buffer
): Promise<ParsedDocument> {
  let text = '';

  if (extension === 'pdf') {
    text = await extractPdfText(buffer);
  } else if (extension === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else if (extension === 'xlsx' || extension === 'xls') {
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
    });

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
  response.setHeader('Content-Type', 'application/json');

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    console.log('[api/analyze] Started');

    const files = flattenFormidableFiles(await parseForm(request));

    console.log('[api/analyze] Files received:', files.length);

    if (files.length === 0) {
      response.status(400).json({ error: 'No files were uploaded.' });
      return;
    }

    const parsedDocuments: ParsedDocument[] = [];
    const skippedFiles: string[] = [];

    for (const file of files) {
      const originalName = file.originalFilename ?? file.newFilename;
      const extension = getExtension(originalName);

      console.log('[api/analyze] Processing:', originalName, extension);

      if (!isSupportedExtension(extension)) {
        skippedFiles.push(originalName);
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

    console.log('[api/analyze] Parsed documents:', parsedDocuments.length);

    if (parsedDocuments.length === 0) {
      response.status(400).json({
        error:
          'No supported files were found. Please upload PDF, DOCX, XLSX, CSV, ZIP, TXT, MD, or JSON files.',
        skippedFiles,
      });
      return;
    }

    const analysisResult = buildAnalysisResultFromDocuments(parsedDocuments);

    console.log('[api/analyze] AnalysisResult created:', {
      documents: analysisResult.documents.length,
      vendors: analysisResult.vendors.length,
      gaps: analysisResult.gaps.length,
      evidence: analysisResult.evidence.length,
    });

    response.status(200).json({
      ...analysisResult,
      meta: {
        skippedFiles,
      },
    });
  } catch (error) {
    const message = getErrorMessage(error);

    console.error('[api/analyze] Error object:', error);

    if (error instanceof Error) {
      console.error('[api/analyze] Error name:', error.name);
      console.error('[api/analyze] Error message:', error.message);
      console.error('[api/analyze] Error stack:', error.stack);
    }

    response.status(500).json({
      error: message,
    });
  }
}
