import type { ParsedDocument } from '../ingestion/types';
import type { ServerParsedDocument } from './types';

export function adaptServerParsedDocuments(
  documents: ServerParsedDocument[]
): ParsedDocument[] {
  return documents.map((document) => ({
    fileName: document.fileName,
    extension: document.extension,
    text: document.text,
    size: document.size,
  }));
}
