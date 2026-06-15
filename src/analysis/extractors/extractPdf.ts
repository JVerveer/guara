export async function extractPdf(file: File): Promise<string> {
  // Browser-side PDF text extraction is intentionally deferred.
  // For now, this keeps the ingestion pipeline working and lets rule-based detection
  // use file names. Later, move PDF extraction to /api/analyze with pdf-parse.
  return [
    `PDF document uploaded: ${file.name}`,
    'PDF text extraction should be performed server-side for production analysis.',
  ].join('\n');
}
