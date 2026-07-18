import { describe, it, expect } from "vitest";
import {
  parseDelimited,
  detectColumnMap,
  normalizeRank,
  normalizeStatus,
  planImport,
} from "../taxon-import";

describe("parseDelimited", () => {
  it("parses CSV with quoted fields", () => {
    const rows = parseDelimited('name,authority\n"Cattleya labiata","Lindl."\n');
    expect(rows).toEqual([{ name: "Cattleya labiata", authority: "Lindl." }]);
  });
  it("auto-detects tab-separated (Darwin-Core)", () => {
    const rows = parseDelimited("scientificName\ttaxonRank\nVanda falcata\tSpecies");
    expect(rows[0]).toEqual({ scientificName: "Vanda falcata", taxonRank: "Species" });
  });
});

describe("detectColumnMap", () => {
  it("maps Darwin-Core headers", () => {
    const map = detectColumnMap([
      "taxonID",
      "scientificName",
      "taxonRank",
      "acceptedNameUsageID",
      "taxonomicStatus",
    ]);
    expect(map.id).toBe("taxonID");
    expect(map.name).toBe("scientificName");
    expect(map.rank).toBe("taxonRank");
    expect(map.acceptedId).toBe("acceptedNameUsageID");
    expect(map.status).toBe("taxonomicStatus");
  });
  it("maps WCVP-style headers", () => {
    const map = detectColumnMap(["plant_name_id", "taxon_name", "taxon_rank", "taxon_status", "accepted_plant_name_id"]);
    expect(map.id).toBe("plant_name_id");
    expect(map.name).toBe("taxon_name");
    expect(map.acceptedId).toBe("accepted_plant_name_id");
  });
});

describe("normalizeRank", () => {
  it("maps common ranks and infra-specific ranks to our set", () => {
    expect(normalizeRank("Species")).toBe("SPECIES");
    expect(normalizeRank("GENUS")).toBe("GENUS");
    expect(normalizeRank("subsp.")).toBe("SPECIES");
    expect(normalizeRank("Subtribe")).toBe("SUBTRIBE");
    expect(normalizeRank("grex")).toBe("GREX");
  });
  it("returns null for an unknown rank", () => {
    expect(normalizeRank("section")).toBe(null);
    expect(normalizeRank("")).toBe(null);
  });
});

describe("normalizeStatus", () => {
  it("classifies status strings", () => {
    expect(normalizeStatus("Accepted")).toBe("ACCEPTED");
    expect(normalizeStatus("Synonym")).toBe("SYNONYM");
    expect(normalizeStatus("Homotypic_Synonym")).toBe("SYNONYM");
    expect(normalizeStatus("Unplaced")).toBe("DEPRECATED");
    expect(normalizeStatus(undefined)).toBe("ACCEPTED");
  });
});

describe("planImport", () => {
  // Uniform columns, as a real CSV/Darwin-Core export would have.
  const csv =
    "taxonID,scientificName,taxonRank,taxonomicStatus,acceptedNameUsageID,genus,family\n" +
    "1,Vanda,Genus,Accepted,,,Orchidaceae\n" +
    "2,Vanda falcata,Species,Accepted,,Vanda,Orchidaceae\n" +
    "3,Neofinetia falcata,Species,Synonym,2,Neofinetia,Orchidaceae\n" +
    "4,,Species,Accepted,,,Orchidaceae\n";
  const rows = parseDelimited(csv);
  const map = detectColumnMap(Object.keys(rows[0]));

  it("plans accepted + synonym rows and skips nameless rows", () => {
    const plan = planImport(rows, map);
    expect(plan.stats.planned).toBe(3);
    expect(plan.stats.skipped).toBe(1);
    expect(plan.stats.synonyms).toBe(1);
  });

  it("derives species parent from the genus column", () => {
    const plan = planImport(rows, map);
    const species = plan.taxa.find((t) => t.name === "Vanda falcata")!;
    expect(species.parentRef).toEqual({ name: "Vanda" });
  });

  it("captures a synonym's accepted reference", () => {
    const plan = planImport(rows, map);
    const syn = plan.taxa.find((t) => t.name === "Neofinetia falcata")!;
    expect(syn.status).toBe("SYNONYM");
    expect(syn.acceptedRef).toEqual({ id: "2", name: undefined });
  });
});
