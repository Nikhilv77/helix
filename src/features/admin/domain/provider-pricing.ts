/**
 * List prices used to estimate spend on the admin Cost page, in US dollars.
 * They are estimates: free-tier calls really cost nothing, and providers
 * change prices. Edit this table when a bill disagrees with the dashboard.
 *
 * Last checked: October 2026.
 */
export interface ProviderPrice {
  /** Per million input tokens. */
  inputPerMillion?: number;
  /** Per million output tokens (thinking included). */
  outputPerMillion?: number;
  /** Per unit: one character of speech, or one code run. */
  perUnit?: number;
  /** Per second of run time (Vercel Sandbox bills VM time). */
  perSecond?: number;
}

interface PriceRule {
  provider: string;
  model: RegExp;
  price: ProviderPrice;
}

const RULES: PriceRule[] = [
  // Gemini text. "latest" aliases follow the current Flash and Flash-Lite.
  { provider: "gemini", model: /tts/i, price: { perUnit: 0.017 / 1_000 } },
  { provider: "gemini", model: /flash-lite/i, price: { inputPerMillion: 0.1, outputPerMillion: 0.4 } },
  { provider: "gemini", model: /flash/i, price: { inputPerMillion: 0.3, outputPerMillion: 2.5 } },
  { provider: "gemini", model: /pro/i, price: { inputPerMillion: 1.25, outputPerMillion: 10 } },
  // Groq.
  { provider: "groq", model: /gpt-oss-20b/i, price: { inputPerMillion: 0.075, outputPerMillion: 0.3 } },
  { provider: "groq", model: /gpt-oss-120b/i, price: { inputPerMillion: 0.15, outputPerMillion: 0.6 } },
  { provider: "groq", model: /.*/, price: { inputPerMillion: 0.1, outputPerMillion: 0.4 } },
  // Speech: Deepgram Aura is priced per thousand characters.
  { provider: "deepgram", model: /.*/, price: { perUnit: 0.015 / 1_000 } },
  // Code. Judge0 is self-hosted or a flat plan, so a run has no marginal price.
  { provider: "judge0", model: /.*/, price: { perUnit: 0 } },
  // One vCPU plus its memory, about $0.15 an hour of VM time.
  { provider: "vercel-sandbox", model: /.*/, price: { perSecond: 0.15 / 3_600 } }
];

export function priceFor(provider: string, model: string): ProviderPrice | null {
  return RULES.find((rule) => rule.provider === provider && rule.model.test(model))?.price ?? null;
}

export function estimateCost(input: {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  units: number;
  durationMs: number;
}): number {
  const price = priceFor(input.provider, input.model);
  if (!price) return 0;
  return (
    (input.inputTokens / 1_000_000) * (price.inputPerMillion ?? 0) +
    (input.outputTokens / 1_000_000) * (price.outputPerMillion ?? 0) +
    input.units * (price.perUnit ?? 0) +
    (input.durationMs / 1_000) * (price.perSecond ?? 0)
  );
}
