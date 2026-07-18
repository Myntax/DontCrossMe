// Opt-in AI synthesis via the Anthropic Messages API. Three independent gates
// must all pass for a single byte to leave the machine:
//   1. AI_ENABLED=true and an API key is configured (handled by the factory),
//   2. the licensing gate marks the evidence AI-eligible,
//   3. the model is asked only to REPHRASE the engine's output — the
//      deterministic summary remains the source of truth.
// Any failure falls back to the deterministic narrative so AI never breaks a flow.

import type { AiProvider, SynthesisRequest, SynthesisResult } from "./provider";
import { assertAllEligible, filterAiEligible } from "./licensing-gate";
import { NullProvider } from "./null-provider";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export class AnthropicProvider implements AiProvider {
  readonly enabled = true;
  readonly name: string;
  private apiKey: string;
  private model: string;
  private fetchImpl: typeof fetch;
  private fallback = new NullProvider();

  constructor(opts: AnthropicProviderOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? "claude-opus-4-8";
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.name = `anthropic (${this.model})`;
  }

  async synthesize(req: SynthesisRequest): Promise<SynthesisResult> {
    const eligible = filterAiEligible(req.evidence);
    try {
      assertAllEligible(eligible); // backstop
      const prompt = this.buildPrompt(req, eligible);
      const res = await this.fetchImpl(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 700,
          system:
            "You are helping an orchid breeding society. You will be given a deterministic " +
            "analysis and its supporting evidence. Rephrase it into clear, practical prose for " +
            "a grower. Do NOT introduce facts, numbers, or recommendations that are not in the " +
            "provided analysis or evidence. Preserve every citation.",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        return this.fail(req, `Anthropic API returned ${res.status}`);
      }
      const data = (await res.json()) as {
        content?: { type: string; text?: string }[];
      };
      const text =
        data.content
          ?.filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("\n")
          .trim() ?? "";
      if (!text) return this.fail(req, "Empty response from model");

      return {
        narrative: text,
        aiUsed: true,
        usedEvidenceIds: eligible.map((e) => e.id),
        model: this.model,
      };
    } catch (err) {
      return this.fail(req, err instanceof Error ? err.message : "AI error");
    }
  }

  private async fail(req: SynthesisRequest, note: string): Promise<SynthesisResult> {
    const base = await this.fallback.synthesize(req);
    return { ...base, note: `AI unavailable, showing deterministic result: ${note}` };
  }

  private buildPrompt(req: SynthesisRequest, eligible: SynthesisRequest["evidence"]): string {
    const parts: string[] = [];
    parts.push(`Analysis type: ${req.kind}`);
    parts.push(`Deterministic summary (source of truth): ${req.deterministicSummary}`);
    if (req.points.length) {
      parts.push("Key points:");
      for (const p of req.points) parts.push(`- ${p}`);
    }
    if (eligible.length) {
      parts.push("Supporting evidence (each may be cited):");
      for (const e of eligible) {
        const cite = e.citation ? ` [${e.citation}]` : "";
        const src = e.sourceTitle ? ` (${e.sourceTitle})` : "";
        parts.push(`- ${e.text}${src}${cite}`);
      }
    } else {
      parts.push(
        "No AI-eligible supporting evidence was provided; rely only on the summary and points.",
      );
    }
    parts.push(
      "Write 1–2 short paragraphs of practical guidance for the grower, then a one-line confidence note.",
    );
    return parts.join("\n");
  }
}
