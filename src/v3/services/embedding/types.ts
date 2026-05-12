// Layer 2 · embedding provider interface.

export type EmbeddingProvider = {
  readonly name: string;
  readonly dim: number;
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
};
