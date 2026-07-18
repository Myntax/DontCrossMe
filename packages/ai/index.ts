// AI layer entry point. `getAiProvider()` reads configuration and returns the
// deterministic NullProvider unless AI is explicitly enabled AND a key exists.
// Off is the default in every ambiguous case.

import type { AiProvider } from "./provider";
import { NullProvider } from "./null-provider";
import { AnthropicProvider } from "./anthropic-provider";

export * from "./provider";
export * from "./licensing-gate";
export { NullProvider } from "./null-provider";
export { AnthropicProvider } from "./anthropic-provider";

export interface AiConfig {
  enabled?: boolean;
  apiKey?: string;
  model?: string;
}

/** Resolve a provider from explicit config (falls back to env). */
export function getAiProvider(config?: AiConfig): AiProvider {
  const enabled =
    config?.enabled ?? process.env.AI_ENABLED === "true";
  const apiKey = config?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
  const model = config?.model ?? process.env.AI_MODEL ?? "claude-opus-4-8";

  if (enabled && apiKey) {
    return new AnthropicProvider({ apiKey, model });
  }
  return new NullProvider();
}

/** True when a real AI backend is active. Handy for UI badges. */
export function isAiActive(config?: AiConfig): boolean {
  return getAiProvider(config).enabled;
}
