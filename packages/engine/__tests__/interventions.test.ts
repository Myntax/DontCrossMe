import { describe, it, expect } from "vitest";
import { suggestInterventions } from "../interventions";
import { summarizeOutcomes } from "../evidence";

describe("suggestInterventions", () => {
  it("suggests embryo rescue for a very difficult wide cross", () => {
    const s = suggestInterventions({ crossType: "MULTIGENERIC", viabilityScore: 18 });
    const types = s.map((x) => x.type);
    expect(types).toContain("EMBRYO_RESCUE");
    expect(types).toContain("GREEN_POD_FLASK");
  });

  it("does not suggest embryo rescue for an easy intraspecific cross", () => {
    const s = suggestInterventions({ crossType: "INTRASPECIFIC", viabilityScore: 90 });
    expect(s.map((x) => x.type)).not.toContain("EMBRYO_RESCUE");
  });

  it("boosts interventions that have worked here and damps those that failed", () => {
    const success = summarizeOutcomes(
      Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, success: true })),
    );
    const failure = summarizeOutcomes(
      Array.from({ length: 8 }, (_, i) => ({ id: `f${i}`, success: false })),
    );

    const boosted = suggestInterventions({
      crossType: "INTERGENERIC",
      viabilityScore: 30,
      history: { RECIPROCAL_CROSS: success },
    });
    const damped = suggestInterventions({
      crossType: "INTERGENERIC",
      viabilityScore: 30,
      history: { RECIPROCAL_CROSS: failure },
    });

    const rankIn = (list: ReturnType<typeof suggestInterventions>) =>
      list.find((x) => x.type === "RECIPROCAL_CROSS")!.rank;

    expect(rankIn(boosted)).toBeGreaterThan(rankIn(damped));
  });

  it("returns suggestions sorted by rank descending", () => {
    const s = suggestInterventions({ crossType: "INTERGENERIC", viabilityScore: 25 });
    for (let i = 1; i < s.length; i++) {
      expect(s[i - 1].rank).toBeGreaterThanOrEqual(s[i].rank);
    }
  });

  it("honors a custom catalog (user-added techniques)", () => {
    const custom = [
      {
        type: "CUSTOM_CO2_ENRICHMENT",
        label: "CO₂ enrichment",
        description: "Raise ambient CO₂ during capsule development.",
        appliesTo: ["INTERGENERIC" as const],
        maxViability: 60,
        basePriority: 9,
      },
    ];
    const s = suggestInterventions(
      { crossType: "INTERGENERIC", viabilityScore: 30 },
      custom,
    );
    expect(s.map((x) => x.type)).toEqual(["CUSTOM_CO2_ENRICHMENT"]);
    // built-ins are NOT included when a custom catalog is supplied
    expect(s.map((x) => x.type)).not.toContain("EMBRYO_RESCUE");
  });

  it("attaches observed evidence when history is present", () => {
    const hist = summarizeOutcomes([
      { id: "a", success: true },
      { id: "b", success: false },
    ]);
    const s = suggestInterventions({
      crossType: "INTERGENERIC",
      viabilityScore: 30,
      history: { MENTOR_POLLEN: hist },
    });
    const mp = s.find((x) => x.type === "MENTOR_POLLEN")!;
    expect(mp.observed).toEqual({ successes: 1, attempts: 2, rate: 0.5 });
    expect(mp.evidenceIds).toEqual(["a", "b"]);
  });
});
