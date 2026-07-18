// The default provider. Does not exist to "fake" AI — it is the honest, fully
// functional non-AI path. It composes the engine's own deterministic output
// into readable text locally; no data ever leaves the machine.

import type { AiProvider, SynthesisRequest, SynthesisResult } from "./provider";

export class NullProvider implements AiProvider {
  readonly enabled = false;
  readonly name = "none (deterministic)";

  async synthesize(req: SynthesisRequest): Promise<SynthesisResult> {
    const lines: string[] = [req.deterministicSummary];
    if (req.points.length) {
      lines.push("");
      for (const p of req.points) lines.push(`• ${p}`);
    }
    if (req.evidence.length) {
      lines.push("");
      lines.push("Based on:");
      for (const e of req.evidence) {
        const cite = e.citation ? ` (${e.citation})` : "";
        const src = e.sourceTitle ? ` — ${e.sourceTitle}` : "";
        lines.push(`  - ${e.text}${src}${cite}`);
      }
    }
    return {
      narrative: lines.join("\n"),
      aiUsed: false,
      usedEvidenceIds: req.evidence.map((e) => e.id),
    };
  }
}
