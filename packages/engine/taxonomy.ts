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

// ---------------------------------------------------------------------------
// Reclassification support (pure). These operate on plain maps so they can be
// unit-tested without a database, and are used by the DB adapter/service to
// keep analysis correct as taxa get reclassified, merged, and split.
// ---------------------------------------------------------------------------

export interface AcceptedResolvable {
  acceptedTaxonId?: string | null;
  status?: string | null;
}

/**
 * Follow a taxon's synonym/deprecated redirect to its currently accepted taxon.
 * Cycle-guarded (returns the last id seen if a loop is detected).
 */
export function resolveAccepted(
  map: Map<string, AcceptedResolvable>,
  id: string,
): string {
  const seen = new Set<string>();
  let current = id;
  while (!seen.has(current)) {
    seen.add(current);
    const node = map.get(current);
    if (!node) return current;
    const status = node.status ?? "ACCEPTED";
    if ((status === "SYNONYM" || status === "DEPRECATED") && node.acceptedTaxonId) {
      current = node.acceptedTaxonId;
      continue;
    }
    return current;
  }
  return current; // cycle
}

/**
 * Map a hybrid genus's component genera through reclassification to their current
 * accepted genera, de-duplicated. E.g. after Sophronitis+Laelia are sunk into
 * Cattleya, {Sophronitis, Laelia, Cattleya} → {Cattleya}.
 */
export function computeEffectiveComponents(
  componentGenusIds: string[],
  map: Map<string, AcceptedResolvable>,
): string[] {
  const set = new Set<string>();
  for (const g of componentGenusIds) set.add(resolveAccepted(map, g));
  return [...set];
}

export interface CollapseResult {
  collapsed: boolean;
  effectiveComponents: string[];
  collapsedInto?: string;
}

/**
 * A nothogenus "collapses" when its components resolve to a single accepted genus
 * — it is no longer a hybrid genus, and its intergeneric grexes become
 * intra-generic. Detecting this is what drives the reclassification review queue.
 */
export function detectCollapse(
  componentGenusIds: string[],
  map: Map<string, AcceptedResolvable>,
): CollapseResult {
  const effectiveComponents = computeEffectiveComponents(componentGenusIds, map);
  const collapsed = effectiveComponents.length <= 1;
  return {
    collapsed,
    effectiveComponents,
    collapsedInto: collapsed ? effectiveComponents[0] : undefined,
  };
}
