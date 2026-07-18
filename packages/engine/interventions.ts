// Intervention suggestions for difficult / unlikely crosses. A curated catalog
// of techniques is filtered by cross-type and viability, then re-ranked by what
// has actually worked in this program (observed success feeds back in).

import type { OutcomeSummary } from "./evidence";
import { countToConfidence } from "./evidence";
import type { Confidence, CrossType, InterventionType } from "./enums";

interface CatalogEntry {
  type: InterventionType;
  label: string;
  description: string;
  /// cross types this technique is typically relevant to
  appliesTo: CrossType[];
  /// only surface when viability is at/below this (0–100); 100 = always
  maxViability: number;
  /// baseline priority (higher = suggested sooner) before evidence adjustment
  basePriority: number;
}

export const INTERVENTION_CATALOG: CatalogEntry[] = [
  {
    type: "GREEN_POD_FLASK",
    label: "Green-pod (embryo) flasking",
    description:
      "Harvest the capsule before dehiscence and sow immature seed in vitro to bypass slow or blocked natural germination.",
    appliesTo: ["INTERSPECIFIC", "INTERGENERIC", "MULTIGENERIC"],
    maxViability: 80,
    basePriority: 8,
  },
  {
    type: "EMBRYO_RESCUE",
    label: "Embryo rescue",
    description:
      "Excise and culture embryos directly when hybrid seed aborts due to endosperm failure — key for wide crosses.",
    appliesTo: ["INTERGENERIC", "MULTIGENERIC"],
    maxViability: 45,
    basePriority: 9,
  },
  {
    type: "RECIPROCAL_CROSS",
    label: "Try the reciprocal cross",
    description:
      "Swap seed and pollen parents; unilateral incompatibility means the cross often works far better one direction.",
    appliesTo: ["INTERSPECIFIC", "INTERGENERIC", "MULTIGENERIC"],
    maxViability: 70,
    basePriority: 7,
  },
  {
    type: "MENTOR_POLLEN",
    label: "Mentor (nurse) pollen",
    description:
      "Mix irradiated/killed compatible pollen with the target pollen to help overcome stigmatic incompatibility.",
    appliesTo: ["INTERGENERIC", "MULTIGENERIC"],
    maxViability: 40,
    basePriority: 5,
  },
  {
    type: "MIXED_POLLEN",
    label: "Mixed / bulk pollen",
    description:
      "Apply pollen from several plants of the pollen parent to raise the chance of a compatible combination.",
    appliesTo: ["INTERSPECIFIC", "INTERGENERIC"],
    maxViability: 60,
    basePriority: 4,
  },
  {
    type: "STIGMA_PREP",
    label: "Stigma preparation",
    description:
      "Cut-style / grafted-style pollination or removing part of the stigma to shorten pollen-tube travel in wide crosses.",
    appliesTo: ["INTERGENERIC", "MULTIGENERIC"],
    maxViability: 35,
    basePriority: 4,
  },
  {
    type: "TIMING_ADJUST",
    label: "Adjust pollination timing",
    description:
      "Pollinate at peak stigmatic receptivity (often 3–5 days after anthesis) and re-apply over several days.",
    appliesTo: ["INTRASPECIFIC", "INTERSPECIFIC", "INTERGENERIC", "MULTIGENERIC"],
    maxViability: 75,
    basePriority: 6,
  },
  {
    type: "GROWTH_REGULATOR",
    label: "Growth-regulator treatment",
    description:
      "Apply auxin/GA to the ovary to reduce capsule abscission after difficult pollinations.",
    appliesTo: ["INTERSPECIFIC", "INTERGENERIC", "MULTIGENERIC"],
    maxViability: 50,
    basePriority: 3,
  },
  {
    type: "PLOIDY_CONVERSION",
    label: "Ploidy conversion of a parent",
    description:
      "Convert a diploid parent to tetraploid (e.g. oryzalin) beforehand to restore even-ploidy pairing with a tetraploid partner.",
    appliesTo: ["INTERSPECIFIC", "INTERGENERIC"],
    maxViability: 45,
    basePriority: 2,
  },
  {
    type: "POLLEN_STORAGE",
    label: "Stored / dried pollen",
    description:
      "Use desiccated, refrigerated or frozen pollen to bridge asynchronous flowering between the two parents.",
    appliesTo: ["INTRASPECIFIC", "INTERSPECIFIC", "INTERGENERIC", "MULTIGENERIC"],
    maxViability: 90,
    basePriority: 3,
  },
];

export interface InterventionSuggestion {
  type: InterventionType;
  label: string;
  description: string;
  /// final rank score (higher first)
  rank: number;
  rationale: string;
  confidence: Confidence;
  observed?: { successes: number; attempts: number; rate: number };
  evidenceIds: string[];
}

export interface SuggestInterventionsInput {
  crossType: CrossType;
  viabilityScore: number;
  /// observed outcomes per intervention type from this program
  history?: Partial<Record<InterventionType, OutcomeSummary>>;
}

/**
 * Rank interventions for a given cross context. Techniques that have actually
 * worked here are boosted; techniques that have repeatedly failed are damped —
 * this is the intervention side of "learning over time".
 */
export function suggestInterventions(
  input: SuggestInterventionsInput,
): InterventionSuggestion[] {
  const { crossType, viabilityScore, history = {} } = input;
  const out: InterventionSuggestion[] = [];

  for (const entry of INTERVENTION_CATALOG) {
    if (!entry.appliesTo.includes(crossType)) continue;
    if (viabilityScore > entry.maxViability) continue;

    let rank = entry.basePriority;
    const rationaleBits: string[] = [];
    let confidence: Confidence = "NONE";
    let observed: InterventionSuggestion["observed"];
    let evidenceIds: string[] = [];

    // Difficulty bump: the lower the viability, the more we favour stronger
    // techniques (those with a lower maxViability threshold).
    const difficulty = (100 - viabilityScore) / 100;
    rank += difficulty * (100 - entry.maxViability) * 0.05;

    const hist = history[entry.type];
    if (hist && hist.attempts > 0) {
      observed = {
        successes: hist.successes,
        attempts: hist.attempts,
        rate: hist.rate,
      };
      confidence = countToConfidence(hist.attempts);
      evidenceIds = hist.evidenceIds;
      // Boost by the conservative observed success rate, damp on failure.
      const adjust = (hist.wilsonLower - 0.3) * 8;
      rank += adjust;
      rationaleBits.push(
        `${hist.successes}/${hist.attempts} local attempts succeeded`,
      );
    }

    rationaleBits.unshift(
      `Relevant to ${crossType.toLowerCase()} crosses at viability ${viabilityScore}`,
    );

    out.push({
      type: entry.type,
      label: entry.label,
      description: entry.description,
      rank: Math.round(rank * 100) / 100,
      rationale: rationaleBits.join("; ") + ".",
      confidence,
      observed,
      evidenceIds,
    });
  }

  return out.sort((a, b) => b.rank - a.rank);
}
