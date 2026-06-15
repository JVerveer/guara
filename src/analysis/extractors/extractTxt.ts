export async function extractTxt(file: File): Promise<string> {
  return file.text();
}
