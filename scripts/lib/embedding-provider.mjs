import { createHash } from "node:crypto";

export class LocalHashEmbeddingProvider {
  constructor({ version = "v1", dimensions = 64 } = {}) {
    this.model = "guara-local-hash-64";
    this.version = version;
    this.dimensions = dimensions;
  }

  async embedTexts(texts) {
    return texts.map((text) => this.embedText(text));
  }

  embedText(text) {
    const vector = Array.from({ length: this.dimensions }, () => 0);
    const tokens = String(text ?? "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    for (const token of tokens) {
      const digest = createHash("sha256").update(token).digest();
      for (let index = 0; index < 8; index += 1) {
        const slot = digest[index] % vector.length;
        vector[slot] += digest[index + 8] >= 128 ? -1 : 1;
      }
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => Number((value / norm).toFixed(6)));
  }
}

export function vectorLiteral(vector) {
  return `[${vector.map((value) => Number(value).toFixed(6)).join(",")}]`;
}
