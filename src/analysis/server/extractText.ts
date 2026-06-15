import type { ParsedDocument } from './types';

async function extractDocxText(buffer: Buffer) {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });

  return result.value;
}

async function extractSpreadsheetText(buffer: Buffer) {
  const XLSX = await import('xlsx');

  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
  });

  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);

    return `Sheet: ${sheetName}\n${csv}`;
  }).join('\n\n');
}

export async function extractText(
  fileName: string,
  extension: string,
  buffer: Buffer
): Promise<ParsedDocument> {
  let text = '';

  if (extension === 'pdf') {
    // pdf-parse/pdfjs can fail on Vercel Node because DOMMatrix is not available.
    // Keep PDFs in the document list for now, but do not block CSV/DOCX/XLSX analysis.
    text = [
      `PDF uploaded: ${fileName}`,
      'PDF text extraction is temporarily disabled in the Vercel function.',
      'CSV, XLSX, DOCX, TXT, MD, JSON, and ZIP extraction remain enabled.',
    ].join('\n');
  } else if (extension === 'docx') {
    text = await extractDocxText(buffer);
  } else if (extension === 'xlsx' || extension === 'xls') {
    text = await extractSpreadsheetText(buffer);
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
