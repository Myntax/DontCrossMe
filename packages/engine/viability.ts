// Cross-viability assessment. Produces a score (1–99) with confidence and a
// transparent, cited breakdown of the factors that produced it. Deterministic:
// the same inputs always yield the same result, and every point is explained.

import { classifyCross, type TaxonInfo, type TaxonomicRelation } from "./taxonomy";
import type { OutcomeSummary } from "./evidence";
import { strongestConfidence, weakestConfidence } from "./evidence";
import type { Confidence, CrossType } from "./enums";

export interface Precedent {
  /// a hybrid of this exact pairing is already known / registered
  knownHybridExists?: boolean;
  /// how many registered grexes exist for this pairing (or close relatives)
  registeredGrexCount?: number;
}

export interface ViabilityInput {
  seedParent: TaxonInfo;
  pollenParent: TaxonInfo;
  precedent?: Precedent;
  /// outcomes recorded in *this* program for this exact pairing
  programOutcomes?: OutcomeSummary;
  /// outcomes for similar crosses (same cross-type / related genera)
  similarOutcomes?: OutcomeSummary;
}

export interface ViabilityFactor {
  key: string;
  label: string;
  /// signed points contributed to the score
  contribution: number;
  detail: string;
  evidenceIds?: string[];
}

export interface ViabilityResult {
  score: number;
  confidence: Confidence;
  crossType: CrossType;
  relation: TaxonomicRelation;
  factors: ViabilityFactor[];
  summary: string;
}

const BASE_BY_TYPE: Record<CrossType, number> = {
  INTRASPECIFIC: 85,
  INTERSPECIFIC: 65,
  INTERGENERIC: 40,
  MULTIGENERIC: 20,
};

function ploidyFactor(a: TaxonInfo, b: TaxonInfo): ViabilityFactor | null {
  const ca = a.chromosomeCount ?? null;
  const cb = b.chromosomeCount ?? null;
  const pa = a.ploidyLevel ?? null;
  const pb = b.ploidyLevel ?? null;

  // A triploid (or any odd ploidy) parent is a strong negative signal.
  if ((pa != null && pa % 2 === 1) || (pb != null && pb % 2 === 1)) {
    return {
      key: "ploidy",
      label: "Ploidy compatibility",
      contribution: -15,
      detail:
        "An odd-ploidy (e.g. triploid) parent is usually largely sterile; expect reduced seed set.",
    };
  }

  if (ca == null || cb == null) {
    return {
      key: "ploidy",
      label: "Ploidy compatibility",
      contribution: -3,
      detail:
        "Chromosome counts unknown for one or both parents — ploidy match could not be checked.",
    };
  }

  if (ca === cb) {
    return {
      key: "ploidy",
      label: "Ploidy compatibility",
      contribution: 8,
      detail: `Matching chromosome counts (2n=${ca}); balanced gametes likely.`,
    };
  }

  const hi = Math.max(ca, cb);
  const lo = Math.min(ca, cb);
  if (lo > 0 && hi % lo === 0) {
    return {
      key: "ploidy",
      label: "Ploidy compatibility",
      contribution: 2,
      detail: `Chromosome counts differ (${lo} vs ${hi}) but are an integer multiple; some viable, likely uneven-ploidy offspring.`,
    };
  }

  return {
    key: "ploidy",
    label: "Ploidy compatibility",
    contribution: -8,
    detail: `Mismatched chromosome counts (${lo} vs ${hi}) that are not simple multiples; meiotic pairing problems likely.`,
  };
}

function precedentFactor(p?: Precedent): ViabilityFactor | null {
  if (!p) return null;
  let contribution = 0;
  const bits: string[] = [];
  if (p.knownHybridExists) {
    contribution += 15;
    bits.push("a hybrid of this pairing is already known/registered");
  }
  const n = p.registeredGrexCount ?? 0;
  if (n > 0) {
    const add = Math.min(10, Math.round(Math.log2(n + 1) * 3));
    contribution += add;
    bits.push(`${n} related registered grex(es)`);
  }
  if (contribution === 0) return null;
  return {
    key: "precedent",
    label: "Known precedent",
    contribution,
    detail: `Precedent supports feasibility: ${bits.join("; ")}.`,
  };
}

// Pseudo-count that pulls small samples toward "no effect": with few attempts
// the observed rate barely moves the score; as evidence accumulates the nudge
// grows toward its full magnitude. This is the empirical half of "learning".
const OUTCOME_PSEUDO_COUNT = 4;

function outcomeFactor(
  key: string,
  label: string,
  summary: OutcomeSummary | undefined,
  scale: number,
): ViabilityFactor | null {
  if (!summary || summary.attempts <= 0) return null;
  const shrink = summary.attempts / (summary.attempts + OUTCOME_PSEUDO_COUNT);
  // Direction from the observed rate; magnitude scaled by how much data we have.
  const centered = summary.rate - 0.5;
  const contribution = Math.round(centered * scale * shrink);
  if (contribution === 0) return null;
  return {
    key,
    label,
    contribution,
    detail: `${summary.successes}/${summary.attempts} succeeded (${(
      summary.rate * 100
    ).toFixed(0)}%, conservative ${(summary.wilsonLower * 100).toFixed(0)}%).`,
    evidenceIds: summary.evidenceIds,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Compute a full, explainable viability assessment. */
export function assessViability(input: ViabilityInput): ViabilityResult {
  const relation = classifyCross(input.seedParent, input.pollenParent);
  const factors: ViabilityFactor[] = [];

  const base = BASE_BY_TYPE[relation.crossType];
  factors.push({
    key: "base",
    label: "Taxonomic distance",
    contribution: base,
    detail: `${relation.crossType.toLowerCase()} cross (distance ${relation.distance}/3)${
      relation.certain ? "" : " — subtribe data missing, distance assumed"
    }.`,
  });

  const ploidy = ploidyFactor(input.seedParent, input.pollenParent);
  if (ploidy) factors.push(ploidy);

  const precedent = precedentFactor(input.precedent);
  if (precedent) factors.push(precedent);

  const program = outcomeFactor(
    "program",
    "This program's outcomes",
    input.programOutcomes,
    40,
  );
  if (program) factors.push(program);

  const similar = outcomeFactor(
    "similar",
    "Outcomes of similar crosses",
    input.similarOutcomes,
    16,
  );
  if (similar) factors.push(similar);

  const raw = factors.reduce((sum, f) => sum + f.contribution, 0);
  const score = clamp(Math.round(raw), 1, 99);

  // Confidence: strongest empirical evidence available, tempered by taxonomic
  // certainty.
  const empirical = strongestConfidence([
    input.programOutcomes?.confidence ?? "NONE",
    input.similarOutcomes?.confidence ?? "NONE",
    input.precedent?.knownHybridExists ? "MEDIUM" : "NONE",
  ]);
  const confidence: Confidence = relation.certain
    ? empirical === "NONE"
      ? "LOW"
      : empirical
    : weakestConfidence([empirical === "NONE" ? "LOW" : empirical, "LOW"]);

  const summary = summarize(score, relation.crossType, confidence);
  return { score, confidence, crossType: relation.crossType, relation, factors, summary };
}

function summarize(
  score: number,
  type: CrossType,
  confidence: Confidence,
): string {
  const band =
    score >= 70
      ? "likely viable"
      : score >= 45
        ? "plausible but uncertain"
        : score >= 25
          ? "difficult — expect intervention to be needed"
          : "unlikely without specialised techniques";
  return `${type.toLowerCase()} cross scored ${score}/100 (${band}); confidence ${confidence.toLowerCase()}.`;
}
