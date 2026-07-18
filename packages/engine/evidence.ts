// Evidence aggregation — the deterministic core of "learning over time".
//
// As real outcomes (pod set, germination, intervention results, culture wins)
// accumulate, we summarise them into success rates with a *confidence-aware*
// lower bound so a single lucky result never masquerades as certainty and the
// numbers tighten honestly as data grows. No AI, no black box.

import type { Confidence } from "./enums";

export interface OutcomeSummary {
  successes: number;
  attempts: number;
  /// naive rate = successes / attempts (0 when no data)
  rate: number;
  /// Wilson score interval lower bound — conservative, count-aware estimate
  wilsonLower: number;
  confidence: Confidence;
  evidenceIds: string[];
}

/**
 * Wilson score interval lower bound for a binomial proportion. With few samples
 * this sits well below the naive rate and rises toward it as `total` grows.
 */
export function wilsonLowerBound(
  successes: number,
  total: number,
  z = 1.96,
): number {
  if (total <= 0) return 0;
  const phat = successes / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const centre = phat + z2 / (2 * total);
  const margin = z * Math.sqrt((phat * (1 - phat) + z2 / (4 * total)) / total);
  return Math.max(0, (centre - margin) / denom);
}

/** Map a sample size to a coarse confidence label. */
export function countToConfidence(total: number): Confidence {
  if (total <= 0) return "NONE";
  if (total < 3) return "LOW";
  if (total < 8) return "MEDIUM";
  return "HIGH";
}

export interface OutcomeRecord {
  id: string;
  /// true = success, false = failure. Records with `success === null` are
  /// treated as "not yet resolved" and excluded from the denominator.
  success: boolean | null;
  weight?: number;
}

/** Summarise a set of binary outcome records. */
export function summarizeOutcomes(records: OutcomeRecord[]): OutcomeSummary {
  const resolved = records.filter((r) => r.success !== null);
  const attempts = resolved.reduce((n, r) => n + (r.weight ?? 1), 0);
  const successes = resolved
    .filter((r) => r.success === true)
    .reduce((n, r) => n + (r.weight ?? 1), 0);
  const rate = attempts > 0 ? successes / attempts : 0;
  return {
    successes,
    attempts,
    rate,
    wilsonLower: wilsonLowerBound(successes, attempts),
    confidence: countToConfidence(attempts),
    evidenceIds: resolved.map((r) => r.id),
  };
}

/** Combine several confidence labels into the weakest present (for a report). */
export function weakestConfidence(levels: Confidence[]): Confidence {
  const order: Confidence[] = ["NONE", "LOW", "MEDIUM", "HIGH"];
  let idx = order.length - 1;
  for (const l of levels) idx = Math.min(idx, order.indexOf(l));
  return order[Math.max(0, idx)];
}

/** Combine several confidence labels into the strongest present. */
export function strongestConfidence(levels: Confidence[]): Confidence {
  const order: Confidence[] = ["NONE", "LOW", "MEDIUM", "HIGH"];
  let idx = 0;
  for (const l of levels) idx = Math.max(idx, order.indexOf(l));
  return order[idx];
}
