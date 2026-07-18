import { describe, it, expect } from "vitest";
import { classifyCross, taxonPairKey, type TaxonInfo } from "../taxonomy";

const sp = (
  id: string,
  genusId: string,
  subtribeId: string,
  extra: Partial<TaxonInfo> = {},
): TaxonInfo => ({
  id,
  name: id,
  rank: "SPECIES",
  genusId,
  subtribeId,
  ...extra,
});

describe("classifyCross", () => {
  it("same species is intraspecific", () => {
    const a = sp("paph_roth", "paph", "paphiopedilinae");
    const r = classifyCross(a, a);
    expect(r.crossType).toBe("INTRASPECIFIC");
    expect(r.distance).toBe(0);
  });

  it("same genus, different species is interspecific", () => {
    const r = classifyCross(
      sp("paph_roth", "paph", "paphiopedilinae"),
      sp("paph_sanderianum", "paph", "paphiopedilinae"),
    );
    expect(r.crossType).toBe("INTERSPECIFIC");
    expect(r.distance).toBe(1);
  });

  it("different genus, same subtribe is intergeneric", () => {
    const r = classifyCross(
      sp("catt_labiata", "cattleya", "laeliinae"),
      sp("laelia_purpurata", "laelia", "laeliinae"),
    );
    expect(r.crossType).toBe("INTERGENERIC");
    expect(r.distance).toBe(2);
  });

  it("different subtribe is multigeneric (wide)", () => {
    const r = classifyCross(
      sp("catt_labiata", "cattleya", "laeliinae"),
      sp("paph_roth", "paph", "paphiopedilinae"),
    );
    expect(r.crossType).toBe("MULTIGENERIC");
    expect(r.distance).toBe(3);
  });

  it("marks results uncertain when subtribe data is missing", () => {
    const r = classifyCross(
      { id: "a", name: "a", rank: "SPECIES", genusId: "g1" },
      { id: "b", name: "b", rank: "SPECIES", genusId: "g2" },
    );
    expect(r.crossType).toBe("INTERGENERIC");
    expect(r.certain).toBe(false);
  });

  it("treats a GENUS taxon as its own genus", () => {
    const r = classifyCross(
      { id: "cattleya", name: "Cattleya", rank: "GENUS", subtribeId: "laeliinae" },
      sp("catt_labiata", "cattleya", "laeliinae"),
    );
    expect(r.sameGenus).toBe(true);
    expect(r.crossType).toBe("INTERSPECIFIC");
  });
});

describe("taxonPairKey", () => {
  it("is order-independent", () => {
    expect(taxonPairKey("a", "b")).toBe(taxonPairKey("b", "a"));
  });
});
