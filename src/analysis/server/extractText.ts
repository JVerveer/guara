import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import type { ServerExtractedFile, ServerParsedDocument } from './types';

function extractPlainText(buffer: Buffer) {
  return buffer.toString('utf8');
}

async function extractPdfText(buffer: Buffer) {
  const result = await pdfParse(buffer);

  return result.text;
}

async function extractDocxText(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });

  return result.value;
}

function extractSpreadsheetText(buffer: Buffer) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
  });

  const sheetTexts = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);

    return [`Sheet: ${sheetName}`, csv].join('\n');
  });

  return sheetTexts.join('\n\n');
}

export async function extractTextFromServerFile(
  file: ServerExtractedFile
): Promise<ServerParsedDocument> {
  let text = '';

  if (file.extension === 'pdf') {
    text = await extractPdfText(file.buffer);
  } else if (file.extension === 'docx') {
    text = await extractDocxText(file.buffer);
  } else if (file.extension === 'xlsx' || file.extension === 'xls') {
    text = extractSpreadsheetText(file.buffer);
  } else if (
    file.extension === 'csv' ||
    file.extension === 'txt' ||
    file.extension === 'md' ||
    file.extension === 'json'
  ) {
    text = extractPlainText(file.buffer);
  } else {
    text = '';
  }

  return {
    fileName: file.name,
    extension: file.extension,
    text: text.trim(),
    size: file.size,
  };
}

export async function extractTextFromServerFiles(
  files: ServerExtractedFile[]
): Promise<ServerParsedDocument[]> {
  return Promise.all(files.map(extractTextFromServerFile));
}
