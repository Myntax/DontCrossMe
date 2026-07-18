import { describe, it, expect } from "vitest";
import { rankCultureTips, type CultureRecord } from "../culture";

const rec = (
  id: string,
  taxonId: string,
  parameter: string,
  valueText: string,
  outcome: string,
  genusId = "g1",
  sourceType = "OBSERVATION",
): CultureRecord => ({ id, taxonId, genusId, parameter, valueText, outcome, sourceType });

describe("rankCultureTips", () => {
  it("recommends the best-supported value for a parameter", () => {
    const records = [
      rec("1", "t1", "TEMPERATURE", "cool nights", "POSITIVE"),
      rec("2", "t1", "TEMPERATURE", "cool nights", "POSITIVE"),
      rec("3", "t1", "TEMPERATURE", "warm all year", "NEGATIVE"),
    ];
    const tips = rankCultureTips("t1", "g1", records);
    const temp = tips.find((t) => t.parameter === "TEMPERATURE")!;
    expect(temp.recommendation).toBe("cool nights");
    expect(temp.basis).toBe("DIRECT");
  });

  it("improves confidence as corroborating evidence accumulates", () => {
    const few = rankCultureTips("t1", "g1", [
      rec("1", "t1", "LIGHT", "bright shade", "POSITIVE"),
    ]);
    const many = rankCultureTips(
      "t1",
      "g1",
      Array.from({ length: 12 }, (_, i) =>
        rec(String(i), "t1", "LIGHT", "bright shade", "POSITIVE"),
      ),
    );
    const order = ["NONE", "LOW", "MEDIUM", "HIGH"];
    expect(order.indexOf(many[0].confidence)).toBeGreaterThan(
      order.indexOf(few[0].confidence),
    );
  });

  it("falls back to genus-level evidence for an uncommon taxon, flagged as inferred", () => {
    const records = [
      // no direct records for t_rare; genus siblings only
      rec("1", "t_sibling", "WATER", "keep evenly moist", "POSITIVE", "g_rare"),
      rec("2", "t_sibling2", "WATER", "keep evenly moist", "POSITIVE", "g_rare"),
    ];
    const tips = rankCultureTips("t_rare", "g_rare", records);
    const water = tips.find((t) => t.parameter === "WATER")!;
    expect(water.recommendation).toBe("keep evenly moist");
    expect(water.basis).toBe("GENUS_INFERRED");
    expect(["LOW", "MEDIUM"]).toContain(water.confidence);
  });

  it("prefers thin direct evidence over genus inference", () => {
    const records = [
      rec("1", "t1", "MEDIA", "sphagnum", "POSITIVE"),
      rec("2", "t_sibling", "MEDIA", "bark mix", "POSITIVE"),
    ];
    const tips = rankCultureTips("t1", "g1", records);
    const media = tips.find((t) => t.parameter === "MEDIA")!;
    expect(media.recommendation).toBe("sphagnum");
    expect(media.basis).toBe("DIRECT");
  });
});
