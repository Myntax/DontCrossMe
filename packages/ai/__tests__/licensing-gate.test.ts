import { describe, it, expect } from "vitest";
import {
  computeAiEligibility,
  filterAiEligible,
  assertAllEligible,
} from "../licensing-gate";
import { NullProvider } from "../null-provider";
import { getAiProvider, isAiActive } from "../index";
import type { EvidenceSnippet } from "../provider";

describe("computeAiEligibility", () => {
  it("user-authored item with no sources is eligible", () => {
    expect(computeAiEligibility(true, [])).toBe(true);
  });

  it("non-user item with no sources is not eligible", () => {
    expect(computeAiEligibility(false, [])).toBe(false);
  });

  it("is eligible only when ALL linked sources allow AI use", () => {
    expect(computeAiEligibility(true, [true, true])).toBe(true);
    expect(computeAiEligibility(true, [true, false])).toBe(false);
    expect(computeAiEligibility(false, [true])).toBe(true);
  });

  it("one restrictive source blocks an otherwise user-authored item", () => {
    expect(computeAiEligibility(true, [false])).toBe(false);
  });
});

const snip = (id: string, aiEligible: boolean): EvidenceSnippet => ({
  id,
  text: `takeaway ${id}`,
  aiEligible,
});

describe("filterAiEligible / assertAllEligible", () => {
  it("filters out ineligible snippets", () => {
    const kept = filterAiEligible([snip("a", true), snip("b", false)]);
    expect(kept.map((s) => s.id)).toEqual(["a"]);
  });

  it("assert throws if any ineligible snippet remains", () => {
    expect(() => assertAllEligible([snip("a", true), snip("b", false)])).toThrow(
      /non-AI-eligible/,
    );
    expect(() => assertAllEligible([snip("a", true)])).not.toThrow();
  });
});

describe("getAiProvider", () => {
  it("returns the deterministic NullProvider by default", () => {
    const p = getAiProvider({ enabled: false });
    expect(p).toBeInstanceOf(NullProvider);
    expect(p.enabled).toBe(false);
    expect(isAiActive({ enabled: false })).toBe(false);
  });

  it("stays deterministic when enabled but no key is present", () => {
    expect(getAiProvider({ enabled: true, apiKey: "" }).enabled).toBe(false);
  });

  it("NullProvider composes a cited narrative without any network call", async () => {
    const result = await new NullProvider().synthesize({
      kind: "VIABILITY",
      deterministicSummary: "interspecific cross scored 65/100",
      points: ["Matching chromosome counts"],
      evidence: [{ id: "e1", text: "known hybrid exists", aiEligible: false, citation: "RHS 2020" }],
    });
    expect(result.aiUsed).toBe(false);
    expect(result.narrative).toContain("65/100");
    expect(result.narrative).toContain("RHS 2020");
    expect(result.usedEvidenceIds).toEqual(["e1"]);
  });
});
