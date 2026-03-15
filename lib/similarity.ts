/**
 * Cosine Similarity — measuring how "related" two notes are
 *
 * Every note gets converted into a high-dimensional vector (embedding) by Gemini.
 * Words and sentences with similar *meaning* end up as vectors pointing in similar
 * directions in this space — "dog" and "puppy" are nearby, "dog" and "SQL" are far apart.
 *
 * Cosine similarity measures the angle between two vectors:
 *   cos(θ) = (A · B) / (|A| × |B|)
 *
 * Geometrically: if two vectors point in the same direction → cos = 1 (identical meaning).
 * Perpendicular → cos = 0 (unrelated). Opposite → cos = -1 (never happens with embeddings).
 *
 * We use this to draw edges in the graph: if two notes have cosine similarity above
 * a threshold (0.82), they're "related" and get connected visually.
 */

export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  if (magnitude === 0) return 0;

  return dot / magnitude;
};

export const SIMILARITY_THRESHOLD = 0.82;

/**
 * Given one embedding and a list of {id, embedding} pairs,
 * returns the top K most similar note IDs (above threshold).
 */
export const findRelatedNotes = (
  embedding: number[],
  allEmbeddings: { id: string; embedding: number[] }[],
  topK = 5
): string[] => {
  const scored = allEmbeddings
    .map(({ id, embedding: other }) => ({
      id,
      score: cosineSimilarity(embedding, other),
    }))
    .filter(({ score }) => score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map(({ id }) => id);
};
