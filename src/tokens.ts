/**
 * Fast, zero-dependency token count estimator for LLM context estimation.
 * Based on standard subword tokenizer averages across OpenAI, Anthropic, and Gemini:
 * ~4 English characters per token, or ~0.75 words per token.
 *
 * @param text - Input text string.
 * @returns Estimated token count.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Blend character and word heuristic for higher accuracy across mixed code and prose
  const charEstimate = Math.ceil(text.length / 4);
  const words = text.trim().split(/\s+/).length;
  const wordEstimate = Math.ceil(words / 0.75);

  // Return weighted average rounded up
  return Math.ceil(charEstimate * 0.6 + wordEstimate * 0.4);
}

/**
 * Formats a token number into human-readable compact notation (e.g. 1.2k tokens).
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M tokens`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k tokens`;
  }
  return `${tokens} tokens`;
}
