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
  return fileName.split('.').pop()?.toLowerCase() ?? '';
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

export function getDocumentIcon(extension: string) {
  if (extension === 'csv' || extension === 'xlsx' || extension === 'xls') return '📊';
  if (extension === 'pdf') return '📄';
  if (extension === 'docx') return '📝';

  return '📎';
}