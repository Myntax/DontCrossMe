// Taxonomic relationship logic — how "far apart" two parents are, which drives
// the baseline cross-viability estimate.

import type { CrossType, TaxonRank } from "./enums";

export interface TaxonInfo {
  id: string;
  name: string;
  rank: TaxonRank;
  /// id of the containing genus (for a GENUS taxon this may be its own id)
  genusId?: string | null;
  /// id of the containing subtribe, if known
  subtribeId?: string | null;
  chromosomeCount?: number | null;
  /// ploidy multiple: 2 = diploid, 3 = triploid, 4 = tetraploid, ...
  ploidyLevel?: number | null;
}

export interface TaxonomicRelation {
  crossType: CrossType;
  /// 0 = same species … 3 = different subtribe (wide)
  distance: number;
  sameSpecies: boolean;
  sameGenus: boolean;
  sameSubtribe: boolean;
  /// false when subtribe data was missing and we had to assume
  certain: boolean;
}

function effectiveGenusId(t: TaxonInfo): string | undefined {
  if (t.genusId) return t.genusId;
  if (t.rank === "GENUS") return t.id;
  return undefined;
}

function effectiveSpeciesId(t: TaxonInfo): string | undefined {
  return t.rank === "SPECIES" ? t.id : undefined;
}

/**
 * Classify the relationship between two parent taxa. Falls back gracefully when
 * subtribe data is missing (marking the result `certain: false`).
 */
export function classifyCross(a: TaxonInfo, b: TaxonInfo): TaxonomicRelation {
  const genusA = effectiveGenusId(a);
  const genusB = effectiveGenusId(b);
  const spA = effectiveSpeciesId(a);
  const spB = effectiveSpeciesId(b);
  const subA = a.subtribeId ?? undefined;
  const subB = b.subtribeId ?? undefined;

  const sameSpecies = !!spA && !!spB && spA === spB;
  const sameGenus = !!genusA && !!genusB && genusA === genusB;
  const sameSubtribe = !!subA && !!subB && subA === subB;

  if (sameSpecies) {
    return {
      crossType: "INTRASPECIFIC",
      distance: 0,
      sameSpecies,
      sameGenus: true,
      sameSubtribe: true,
      certain: true,
    };
  }
  if (sameGenus) {
    return {
      crossType: "INTERSPECIFIC",
      distance: 1,
      sameSpecies: false,
      sameGenus,
      sameSubtribe: true,
      certain: true,
    };
  }
  if (sameSubtribe) {
    return {
      crossType: "INTERGENERIC",
      distance: 2,
      sameSpecies: false,
      sameGenus: false,
      sameSubtribe,
      certain: true,
    };
  }
  // Different genera. If both subtribes are known and differ, it's a wide
  // (multigeneric-scale) cross. If subtribe data is missing, assume intergeneric
  // but flag the uncertainty.
  if (subA && subB) {
    return {
      crossType: "MULTIGENERIC",
      distance: 3,
      sameSpecies: false,
      sameGenus: false,
      sameSubtribe: false,
      certain: true,
    };
  }
  return {
    crossType: "INTERGENERIC",
    distance: 2,
    sameSpecies: false,
    sameGenus: false,
    sameSubtribe: false,
    certain: false,
  };
}

/** A stable key for pairing outcome evidence, order-independent. */
export function taxonPairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}
