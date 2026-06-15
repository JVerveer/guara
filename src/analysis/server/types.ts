export type ServerExtractedFile = {
  name: string;
  extension: string;
  buffer: Buffer;
  size: number;
};

export type ServerParsedDocument = {
  fileName: string;
  extension: string;
  text: string;
  size: number;
};
