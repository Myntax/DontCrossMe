// Culture-tip ranking. Aggregates observations and literature takeaways for a
// taxon into ranked, confidence-scored recommendations per culture parameter.
// For uncommon orchids with little direct data, it falls back to genus-level
// evidence (clearly flagged as inferred, with lower confidence).

import { countToConfidence, wilsonLowerBound } from "./evidence";
import type { Confidence, CultureParameter, Outcome } from "./enums";

export interface CultureRecord {
  id: string;
  taxonId: string;
  genusId?: string | null;
  parameter: CultureParameter | string;
  valueText: string;
  outcome: Outcome | string;
  /// OBSERVATION (first-hand) or LITERATURE (from a takeaway)
  sourceType: "OBSERVATION" | "LITERATURE" | string;
}

export interface CultureTip {
  parameter: string;
  recommendation: string;
  supportingCount: number;
  positiveCount: number;
  negativeCount: number;
  confidence: Confidence;
  /// DIRECT = evidence about this taxon; GENUS_INFERRED = borrowed from genus
  basis: "DIRECT" | "GENUS_INFERRED";
  evidenceIds: string[];
  alternatives: { value: string; support: number }[];
}

// Literature and first-hand positive observations both count, but a confirmed
// positive first-hand result is weighted a little more than a book claim.
function recordWeight(r: CultureRecord): number {
  const src = r.sourceType === "OBSERVATION" ? 1.0 : 0.8;
  switch (r.outcome) {
    case "POSITIVE":
      return 1.0 * src;
    case "NEUTRAL":
      return 0.4 * src;
    case "NEGATIVE":
      return -1.0 * src;
    default:
      return 0.5 * src; // UNKNOWN — mild support for "this is practised"
  }
}

function normalizeValue(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

interface Bucket {
  parameter: string;
  byValue: Map<
    string,
    { display: string; score: number; ids: string[]; pos: number; neg: number }
  >;
  ids: Set<string>;
  pos: number;
  neg: number;
}

function bucketize(records: CultureRecord[]): Map<string, Bucket> {
  const buckets = new Map<string, Bucket>();
  for (const r of records) {
    let b = buckets.get(r.parameter);
    if (!b) {
      b = { parameter: r.parameter, byValue: new Map(), ids: new Set(), pos: 0, neg: 0 };
      buckets.set(r.parameter, b);
    }
    const key = normalizeValue(r.valueText);
    let v = b.byValue.get(key);
    if (!v) {
      v = { display: r.valueText.trim(), score: 0, ids: [], pos: 0, neg: 0 };
      b.byValue.set(key, v);
    }
    const w = recordWeight(r);
    v.score += w;
    v.ids.push(r.id);
    b.ids.add(r.id);
    if (r.outcome === "POSITIVE") {
      v.pos += 1;
      b.pos += 1;
    } else if (r.outcome === "NEGATIVE") {
      v.neg += 1;
      b.neg += 1;
    }
  }
  return buckets;
}

function tipFromBucket(b: Bucket, basis: CultureTip["basis"]): CultureTip {
  const values = [...b.byValue.values()].sort((a, c) => c.score - a.score);
  const best = values[0];
  const total = b.pos + b.neg;
  let confidence = countToConfidence(b.ids.size);
  // Genus-inferred evidence is never more than MEDIUM confidence.
  if (basis === "GENUS_INFERRED" && confidence === "HIGH") confidence = "MEDIUM";
  // Strong disagreement (lots of negatives) pulls confidence down one notch.
  if (total > 0) {
    const agree = wilsonLowerBound(b.pos, total);
    if (agree < 0.4 && confidence === "HIGH") confidence = "MEDIUM";
    if (agree < 0.25 && confidence === "MEDIUM") confidence = "LOW";
  }
  return {
    parameter: b.parameter,
    recommendation: best?.display ?? "",
    supportingCount: b.ids.size,
    positiveCount: b.pos,
    negativeCount: b.neg,
    confidence,
    basis,
    evidenceIds: [...b.ids],
    alternatives: values
      .slice(1, 4)
      .map((v) => ({ value: v.display, support: Math.round(v.score * 10) / 10 })),
  };
}

export interface RankCultureOptions {
  /// below this many DIRECT records for a parameter, blend in genus evidence
  genusFallbackThreshold?: number;
}

/**
 * Produce ranked culture tips for a target taxon.
 * @param targetTaxonId the taxon we want advice for
 * @param records       all available culture records (any taxon)
 */
export function rankCultureTips(
  targetTaxonId: string,
  targetGenusId: string | null | undefined,
  records: CultureRecord[],
  opts: RankCultureOptions = {},
): CultureTip[] {
  const threshold = opts.genusFallbackThreshold ?? 2;
  const direct = records.filter((r) => r.taxonId === targetTaxonId);
  const genus = targetGenusId
    ? records.filter(
        (r) => r.taxonId !== targetTaxonId && r.genusId === targetGenusId,
      )
    : [];

  const directBuckets = bucketize(direct);
  const genusBuckets = bucketize(genus);

  const parameters = new Set<string>([
    ...directBuckets.keys(),
    ...genusBuckets.keys(),
  ]);

  const tips: CultureTip[] = [];
  for (const param of parameters) {
    const db = directBuckets.get(param);
    if (db && db.ids.size >= threshold) {
      tips.push(tipFromBucket(db, "DIRECT"));
    } else if (db && db.ids.size > 0) {
      // Some direct evidence but thin — prefer it, note low confidence.
      const tip = tipFromBucket(db, "DIRECT");
      if (tip.confidence === "MEDIUM") tip.confidence = "LOW";
      tips.push(tip);
    } else {
      const gb = genusBuckets.get(param);
      if (gb) tips.push(tipFromBucket(gb, "GENUS_INFERRED"));
    }
  }

  const order: Confidence[] = ["HIGH", "MEDIUM", "LOW", "NONE"];
  return tips.sort((a, b) => {
    const c = order.indexOf(a.confidence) - order.indexOf(b.confidence);
    if (c !== 0) return c;
    return b.supportingCount - a.supportingCount;
  });
}
