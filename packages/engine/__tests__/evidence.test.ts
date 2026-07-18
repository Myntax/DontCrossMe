import { describe, it, expect } from "vitest";
import {
  wilsonLowerBound,
  countToConfidence,
  summarizeOutcomes,
  weakestConfidence,
  strongestConfidence,
} from "../evidence";

describe("wilsonLowerBound", () => {
  it("is 0 with no data", () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it("stays conservative (well below naive rate) with tiny samples", () => {
    // 1/1 = 100% naive, but Wilson lower bound must be far lower.
    expect(wilsonLowerBound(1, 1)).toBeLessThan(0.35);
  });

  it("rises toward the naive rate as sample size grows", () => {
    const small = wilsonLowerBound(8, 10);
    const large = wilsonLowerBound(80, 100);
    expect(large).toBeGreaterThan(small);
    expect(large).toBeLessThan(0.8);
  });
});

describe("countToConfidence", () => {
  it("maps sample size to a label", () => {
    expect(countToConfidence(0)).toBe("NONE");
    expect(countToConfidence(2)).toBe("LOW");
    expect(countToConfidence(5)).toBe("MEDIUM");
    expect(countToConfidence(20)).toBe("HIGH");
  });
});

describe("summarizeOutcomes", () => {
  it("excludes unresolved records from the denominator", () => {
    const s = summarizeOutcomes([
      { id: "a", success: true },
      { id: "b", success: false },
      { id: "c", success: null }, // pending — ignored
    ]);
    expect(s.attempts).toBe(2);
    expect(s.successes).toBe(1);
    expect(s.rate).toBe(0.5);
    expect(s.evidenceIds).toEqual(["a", "b"]);
  });

  it("honors weights", () => {
    const s = summarizeOutcomes([
      { id: "a", success: true, weight: 2 },
      { id: "b", success: false, weight: 1 },
    ]);
    expect(s.attempts).toBe(3);
    expect(s.successes).toBe(2);
  });
});

describe("confidence combinators", () => {
  it("weakest picks the lowest", () => {
    expect(weakestConfidence(["HIGH", "LOW", "MEDIUM"])).toBe("LOW");
  });
  it("strongest picks the highest", () => {
    expect(strongestConfidence(["NONE", "LOW", "MEDIUM"])).toBe("MEDIUM");
  });
});
