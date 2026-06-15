export async function extractDocx(file: File): Promise<string> {
  // Browser-side DOCX text extraction is intentionally deferred.
  // For now, this keeps the ingestion pipeline working and lets rule-based detection
  // use file names. Later, add mammoth in the browser or move DOCX extraction to /api/analyze.
  return [
    `DOCX document uploaded: ${file.name}`,
    'DOCX text extraction should be performed server-side for production analysis.',
  ].join('\n');
}
