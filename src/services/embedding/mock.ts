import type { EmbeddingProvider } from "./types";

/**
 * Deterministic hash-based embedding for tests / heuristic mode.
 * Same text -> same vector; different texts -> different vectors.
 * Vectors are L2-normalized so cosine similarity = dot product.
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly name = "mock-embedding";
  readonly dim: number;

  constructor(options: { dim?: number } = {}) {
    this.dim = options.dim ?? 64;
  }

  async embed(text: string): Promise<Float32Array> {
    return Promise.resolve(this.synth(text));
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    return Promise.resolve(texts.map((text) => this.synth(text)));
  }

  private synth(text: string): Float32Array {
    const v = new Float32Array(this.dim);
    let h = 2166136261 >>> 0; // FNV-1a basis
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
      v[i % this.dim] += ((h % 200) - 100) / 100;
    }
    let norm = 0;
    for (let i = 0; i < this.dim; i += 1) norm += v[i] * v[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < this.dim; i += 1) v[i] /= norm;
    return v;
  }
}
