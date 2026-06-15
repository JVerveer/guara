export async function extractCsv(file: File): Promise<string> {
  return file.text();
}
