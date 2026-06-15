export const SUPPORTED_EXTENSIONS = [
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

export function getExtension(fileName: string) {
  const parts = fileName.split('.');

  return parts.length > 1 ? parts.pop()?.toLowerCase() ?? '' : '';
}

export function isSupportedExtension(extension: string) {
  return SUPPORTED_EXTENSIONS.includes(extension.toLowerCase());
}

export function isHiddenOrSystemFile(fileName: string) {
  return (
    fileName.startsWith('__MACOSX/') ||
    fileName.includes('/.') ||
    fileName.startsWith('.') ||
    fileName.endsWith('.DS_Store')
  );
}
