export type ExtractedPackageFile = {
  name: string;
  extension: string;
  mimeType?: string;
  size: number;
  file: File;
};

export type ParsedDocument = {
  fileName: string;
  extension: string;
  text: string;
  size: number;
};
