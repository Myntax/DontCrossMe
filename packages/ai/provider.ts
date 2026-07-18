// The AI layer sits strictly ON TOP of the deterministic engine. It never
// produces a suggestion of its own — it only rephrases the engine's already-
// computed, cited output into fluent prose. Everything works with it disabled.

export type SynthesisKind = "VIABILITY" | "CULTURE" | "INTERVENTION";

/** A single piece of evidence eligible to be shown to a model. */
export interface EvidenceSnippet {
  id: string;
  /// the paraphrased factual takeaway / observation text (never a copyrighted quote)
  text: string;
  /// whether this snippet may be sent to an LLM (see licensing-gate.ts)
  aiEligible: boolean;
  citation?: string;
  sourceTitle?: string;
}

export interface SynthesisRequest {
  kind: SynthesisKind;
  /// the engine's deterministic one-line summary — the source of truth
  deterministicSummary: string;
  /// human-readable bullet points from the engine (factors, tips, etc.)
  points: string[];
  /// supporting evidence; the gate decides what actually reaches a model
  evidence: EvidenceSnippet[];
}

export interface SynthesisResult {
  narrative: string;
  aiUsed: boolean;
  usedEvidenceIds: string[];
  model?: string;
  /// set when AI was requested but could not run (missing key, network, etc.)
  note?: string;
}

export interface AiProvider {
  readonly enabled: boolean;
  readonly name: string;
  synthesize(req: SynthesisRequest): Promise<SynthesisResult>;
}
