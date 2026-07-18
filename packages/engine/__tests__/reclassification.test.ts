import { describe, it, expect } from "vitest";
import {
  resolveAccepted,
  computeEffectiveComponents,
  detectCollapse,
  type AcceptedResolvable,
} from "../taxonomy";

const map = (
  entries: Record<string, AcceptedResolvable>,
): Map<string, AcceptedResolvable> => new Map(Object.entries(entries));

describe("resolveAccepted", () => {
  it("returns the id unchanged for an accepted taxon", () => {
    const m = map({ a: { status: "ACCEPTED" } });
    expect(resolveAccepted(m, "a")).toBe("a");
  });

  it("follows a synonym to its accepted taxon", () => {
    const m = map({
      neofinetia: { status: "SYNONYM", acceptedTaxonId: "vanda" },
      vanda: { status: "ACCEPTED" },
    });
    expect(resolveAccepted(m, "neofinetia")).toBe("vanda");
  });

  it("follows a chain of redirects", () => {
    const m = map({
      a: { status: "SYNONYM", acceptedTaxonId: "b" },
      b: { status: "SYNONYM", acceptedTaxonId: "c" },
      c: { status: "ACCEPTED" },
    });
    expect(resolveAccepted(m, "a")).toBe("c");
  });

  it("is cycle-guarded", () => {
    const m = map({
      a: { status: "SYNONYM", acceptedTaxonId: "b" },
      b: { status: "SYNONYM", acceptedTaxonId: "a" },
    });
    // must terminate rather than loop forever
    expect(["a", "b"]).toContain(resolveAccepted(m, "a"));
  });

  it("returns the id when it is unknown to the map", () => {
    expect(resolveAccepted(map({}), "ghost")).toBe("ghost");
  });
});

describe("computeEffectiveComponents / detectCollapse", () => {
  // After Sophronitis and Laelia were sunk into Cattleya:
  const sunk = map({
    sophronitis: { status: "SYNONYM", acceptedTaxonId: "cattleya" },
    laelia: { status: "SYNONYM", acceptedTaxonId: "cattleya" },
    cattleya: { status: "ACCEPTED" },
    brassavola: { status: "ACCEPTED" },
  });

  it("maps merged component genera to their accepted genus, de-duplicated", () => {
    const eff = computeEffectiveComponents(
      ["sophronitis", "laelia", "cattleya"],
      sunk,
    );
    expect(eff).toEqual(["cattleya"]);
  });

  it("detects a nothogenus collapse (×Sophrolaeliocattleya → Cattleya)", () => {
    const r = detectCollapse(["sophronitis", "laelia", "cattleya"], sunk);
    expect(r.collapsed).toBe(true);
    expect(r.collapsedInto).toBe("cattleya");
  });

  it("does NOT collapse a nothogenus that still spans multiple genera", () => {
    // ×Brassocattleya = Brassavola × Cattleya, both still accepted
    const r = detectCollapse(["brassavola", "cattleya"], sunk);
    expect(r.collapsed).toBe(false);
    expect(r.effectiveComponents.sort()).toEqual(["brassavola", "cattleya"]);
  });
});
