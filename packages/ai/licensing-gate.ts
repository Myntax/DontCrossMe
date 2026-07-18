// The licensing gate is the single chokepoint that decides what knowledge may
// ever reach an LLM. It is applied BEFORE any prompt is assembled. Sources the
// coordinator has not explicitly marked `aiUseAllowed` are usable everywhere in
// the deterministic engine and UI, but are never sent to a model.

import type { EvidenceSnippet } from "./provider";

/**
 * Decide whether a knowledge item's *content* may be sent to an LLM.
 *
 * Policy (conservative by design):
 *  - An item with no linked sources is AI-eligible only if it is the user's own
 *    authored observation/takeaway (their data, their call).
 *  - An item with linked sources is AI-eligible only if EVERY linked source is
 *    explicitly flagged `aiUseAllowed`. One restrictive source blocks it.
 *
 * Verbatim copyrighted quotes are never eligible and must not be placed in an
 * EvidenceSnippet.text in the first place (only paraphrased takeaways are).
 */
export function computeAiEligibility(
  isUserAuthored: boolean,
  sourceAiFlags: boolean[],
): boolean {
  if (sourceAiFlags.length === 0) return isUserAuthored;
  return sourceAiFlags.every(Boolean);
}

/** Keep only snippets that are AI-eligible. */
export function filterAiEligible(evidence: EvidenceSnippet[]): EvidenceSnippet[] {
  return evidence.filter((e) => e.aiEligible);
}

/**
 * Guard used right before a network call: throws if any snippet slated for a
 * prompt is not eligible. A defensive backstop behind `filterAiEligible`.
 */
export function assertAllEligible(evidence: EvidenceSnippet[]): void {
  const bad = evidence.filter((e) => !e.aiEligible);
  if (bad.length > 0) {
    throw new Error(
      `licensing-gate: refusing to send ${bad.length} non-AI-eligible snippet(s) to a model`,
    );
  }
}
