import type { EmbeddingProvider } from "./types";

export type HttpEmbeddingOptions = {
  apiKey: string;
  baseUrl: string;          // e.g. https://api.openai.com/v1
  model: string;            // e.g. text-embedding-3-small
  dim?: number;             // declared dimension (must match model)
  timeoutMs?: number;
  fetch?: typeof fetch;
};

/**
 * Thin OpenAI-compatible /v1/embeddings client. Used in production when an
 * embedding API key is configured. For tests / heuristic mode, prefer
 * MockEmbeddingProvider.
 */
export class HttpEmbeddingProvider implements EmbeddingProvider {
  readonly name: string;
  readonly dim: number;

  constructor(private readonly options: HttpEmbeddingOptions) {
    this.name = `http-embedding:${options.model}`;
    this.dim = options.dim ?? 1536;
  }

  async embed(text: string): Promise<Float32Array> {
    const [vec] = await this.embedBatch([text]);
    return vec;
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    const fetchImpl = this.options.fetch ?? fetch;
    const controller = new AbortController();
    const timer = this.options.timeoutMs
      ? setTimeout(() => controller.abort(), this.options.timeoutMs)
      : null;
    try {
      const response = await fetchImpl(`${this.options.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify({
          model: this.options.model,
          input: texts,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `embedding API ${response.status} ${response.statusText}: ${body.slice(0, 200)}`,
        );
      }
      const json = (await response.json()) as { data: Array<{ embedding: number[] }> };
      return json.data.map((row) => Float32Array.from(row.embedding));
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
