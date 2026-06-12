// cogitatio-virtualis/virtualis-terminal/lib/api/voyage.ts

const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";

/** Mirrors the cogitatio-server embedding modes: 'none' omits input_type. */
export type VoyageInputType = "query" | "document" | "none";

interface VoyageEmbeddingsResponse {
  data: { embedding: number[] }[];
}

/**
 * Embed a single text with the same Voyage model the indexing pipeline used.
 * The model must match the published index or dimensions will disagree, so
 * it is required configuration rather than a silent default.
 */
export async function embedText(
  text: string,
  inputType: VoyageInputType,
): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  const model = process.env.VOYAGE_MODEL;
  if (!apiKey) throw new Error("VOYAGE_API_KEY is not set");
  if (!model) throw new Error("VOYAGE_MODEL is not set");

  const body: Record<string, unknown> = { input: [text], model };
  if (inputType !== "none") body.input_type = inputType;

  const response = await fetch(VOYAGE_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Voyage embeddings request failed (${response.status}): ${detail}`,
    );
  }

  const data = (await response.json()) as VoyageEmbeddingsResponse;
  const embedding = data.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new Error("Voyage embeddings response contained no embedding");
  }
  return embedding;
}
