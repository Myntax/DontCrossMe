import { describe, it, expect } from "vitest";
import { assessViability } from "../viability";
import { summarizeOutcomes } from "../evidence";
import type { TaxonInfo } from "../taxonomy";

const sp = (
  id: string,
  genusId: string,
  subtribeId: string,
  extra: Partial<TaxonInfo> = {},
): TaxonInfo => ({ id, name: id, rank: "SPECIES", genusId, subtribeId, ...extra });

describe("assessViability", () => {
  it("scores decrease as taxonomic distance increases (monotonic baseline)", () => {
    const intraspecific = assessViability({
      seedParent: sp("s1", "g1", "st1"),
      pollenParent: sp("s1", "g1", "st1"),
    }).score;
    const interspecific = assessViability({
      seedParent: sp("s1", "g1", "st1"),
      pollenParent: sp("s2", "g1", "st1"),
    }).score;
    const intergeneric = assessViability({
      seedParent: sp("s1", "g1", "st1"),
      pollenParent: sp("s3", "g2", "st1"),
    }).score;
    const multigeneric = assessViability({
      seedParent: sp("s1", "g1", "st1"),
      pollenParent: sp("s4", "g3", "st2"),
    }).score;

    expect(interspecific).toBeLessThan(intraspecific);
    expect(intergeneric).toBeLessThan(interspecific);
    expect(multigeneric).toBeLessThan(intergeneric);
  });

  it("penalises an odd-ploidy (triploid) parent", () => {
    const base = assessViability({
      seedParent: sp("s1", "g1", "st1"),
      pollenParent: sp("s2", "g1", "st1"),
    }).score;
    const withTriploid = assessViability({
      seedParent: sp("s1", "g1", "st1", { ploidyLevel: 3 }),
      pollenParent: sp("s2", "g1", "st1"),
    }).score;
    expect(withTriploid).toBeLessThan(base);
  });

  it("rewards matching chromosome counts", () => {
    const matched = assessViability({
      seedParent: sp("s1", "g1", "st1", { chromosomeCount: 40 }),
      pollenParent: sp("s2", "g1", "st1", { chromosomeCount: 40 }),
    }).score;
    const mismatched = assessViability({
      seedParent: sp("s1", "g1", "st1", { chromosomeCount: 40 }),
      pollenParent: sp("s2", "g1", "st1", { chromosomeCount: 38 }),
    }).score;
    expect(matched).toBeGreaterThan(mismatched);
  });

  it("raises the score and confidence when a known hybrid exists", () => {
    const without = assessViability({
      seedParent: sp("s1", "g1", "st1"),
      pollenParent: sp("s3", "g2", "st1"),
    });
    const withPrecedent = assessViability({
      seedParent: sp("s1", "g1", "st1"),
      pollenParent: sp("s3", "g2", "st1"),
      precedent: { knownHybridExists: true, registeredGrexCount: 4 },
    });
    expect(withPrecedent.score).toBeGreaterThan(without.score);
  });

  it("incorporates this program's own outcomes (learning over time)", () => {
    const good = summarizeOutcomes(
      Array.from({ length: 10 }, (_, i) => ({ id: `g${i}`, success: true })),
    );
    const bad = summarizeOutcomes(
      Array.from({ length: 10 }, (_, i) => ({ id: `b${i}`, success: false })),
    );
    const optimistic = assessViability({
      seedParent: sp("s1", "g1", "st1"),
      pollenParent: sp("s2", "g1", "st1"),
      programOutcomes: good,
    });
    const pessimistic = assessViability({
      seedParent: sp("s1", "g1", "st1"),
      pollenParent: sp("s2", "g1", "st1"),
      programOutcomes: bad,
    });
    expect(optimistic.score).toBeGreaterThan(pessimistic.score);
    // Ten resolved attempts should read as HIGH confidence.
    expect(optimistic.confidence).toBe("HIGH");
  });

  it("always returns a score in [1, 99] and cites its factors", () => {
    const r = assessViability({
      seedParent: sp("s1", "g1", "st1", { ploidyLevel: 3 }),
      pollenParent: sp("s4", "g3", "st2"),
    });
    expect(r.score).toBeGreaterThanOrEqual(1);
    expect(r.score).toBeLessThanOrEqual(99);
    expect(r.factors.length).toBeGreaterThan(0);
    expect(r.summary).toContain("multigeneric");
  });
});
