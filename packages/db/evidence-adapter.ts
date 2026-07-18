// The bridge between the database and the pure engine. Everything here reads DB
// rows and returns the plain structures the engine consumes — the engine itself
// stays free of Prisma so it remains trivially testable and AI-independent.

import type { PrismaClient, Taxon } from "@prisma/client";
import {
  summarizeOutcomes,
  type OutcomeRecord,
  type OutcomeSummary,
  type TaxonInfo,
  type CultureRecord,
  type Precedent,
  type InterventionType,
} from "@engine/index";
import { prisma as defaultPrisma } from "./client";

/** Extract a numeric ploidy multiple from a free-text ploidy string (e.g. "2n=3x=60" -> 3). */
export function parsePloidyLevel(ploidy: string | null | undefined): number | undefined {
  if (!ploidy) return undefined;
  const m = ploidy.match(/(\d+)\s*x/i);
  return m ? Number(m[1]) : undefined;
}

/** Walk up the taxon hierarchy to find the containing genus and subtribe ids. */
export async function buildTaxonInfo(
  taxonId: string,
  prisma: PrismaClient = defaultPrisma,
): Promise<TaxonInfo | null> {
  const taxon = await prisma.taxon.findUnique({ where: { id: taxonId } });
  if (!taxon) return null;

  let genusId: string | undefined =
    taxon.rank === "GENUS" ? taxon.id : undefined;
  let subtribeId: string | undefined =
    taxon.rank === "SUBTRIBE" ? taxon.id : undefined;

  let current: Taxon | null = taxon;
  let guard = 0;
  while (current?.parentId && guard < 12) {
    guard += 1;
    current = await prisma.taxon.findUnique({ where: { id: current.parentId } });
    if (!current) break;
    if (!genusId && current.rank === "GENUS") genusId = current.id;
    if (!subtribeId && current.rank === "SUBTRIBE") subtribeId = current.id;
  }

  return {
    id: taxon.id,
    name: taxon.name,
    rank: taxon.rank as TaxonInfo["rank"],
    genusId: genusId ?? null,
    subtribeId: subtribeId ?? null,
    chromosomeCount: taxon.chromosomeCount ?? null,
    ploidyLevel: parsePloidyLevel(taxon.ploidy),
  };
}

/** Resolve the effective parent taxa of a cross (plant's taxon or direct taxon). */
async function crossParentTaxonIds(
  crossId: string,
  prisma: PrismaClient,
): Promise<{ seed?: string; pollen?: string }> {
  const cross = await prisma.cross.findUnique({
    where: { id: crossId },
    include: { seedParentPlant: true, pollenParentPlant: true },
  });
  if (!cross) return {};
  return {
    seed: cross.seedParentPlant?.taxonId ?? cross.seedParentTaxonId ?? undefined,
    pollen:
      cross.pollenParentPlant?.taxonId ?? cross.pollenParentTaxonId ?? undefined,
  };
}

function crossSuccess(
  podSet: boolean,
  pollinationSuccess: boolean | null,
): boolean | null {
  if (podSet) return true;
  if (pollinationSuccess === true) return true;
  if (pollinationSuccess === false) return false;
  return null;
}

/**
 * Program outcomes for a specific parent pairing: did the pod set / pollination
 * take? Aggregated across all crosses sharing these two parent taxa.
 */
export async function getPairOutcomes(
  seedTaxonId: string,
  pollenTaxonId: string,
  prisma: PrismaClient = defaultPrisma,
): Promise<OutcomeSummary> {
  const crosses = await prisma.cross.findMany({
    include: {
      seedParentPlant: true,
      pollenParentPlant: true,
      podSets: true,
      pollinations: true,
    },
  });
  const records: OutcomeRecord[] = [];
  for (const c of crosses) {
    const seed = c.seedParentPlant?.taxonId ?? c.seedParentTaxonId ?? undefined;
    const pollen =
      c.pollenParentPlant?.taxonId ?? c.pollenParentTaxonId ?? undefined;
    const matches =
      (seed === seedTaxonId && pollen === pollenTaxonId) ||
      (seed === pollenTaxonId && pollen === seedTaxonId);
    if (!matches) continue;
    const podSet = c.podSets.some((p) => p.set);
    const pollSuccess = c.pollinations.some((p) => p.success === true)
      ? true
      : c.pollinations.some((p) => p.success === false)
        ? false
        : null;
    records.push({ id: c.id, success: crossSuccess(podSet, pollSuccess) });
  }
  return summarizeOutcomes(records);
}

/** Outcomes across all crosses of a given crossType (the wider, "similar" prior). */
export async function getSimilarOutcomes(
  crossType: string,
  prisma: PrismaClient = defaultPrisma,
): Promise<OutcomeSummary> {
  const crosses = await prisma.cross.findMany({
    where: { crossType },
    include: { podSets: true, pollinations: true },
  });
  const records: OutcomeRecord[] = crosses.map((c) => {
    const podSet = c.podSets.some((p) => p.set);
    const pollSuccess = c.pollinations.some((p) => p.success === true)
      ? true
      : c.pollinations.some((p) => p.success === false)
        ? false
        : null;
    return { id: c.id, success: crossSuccess(podSet, pollSuccess) };
  });
  return summarizeOutcomes(records);
}

/** Registered-hybrid precedent for a pairing (looks for a matching grex taxon). */
export async function getPrecedent(
  seedTaxonId: string,
  pollenTaxonId: string,
  prisma: PrismaClient = defaultPrisma,
): Promise<Precedent> {
  const grexes = await prisma.taxon.findMany({
    where: {
      isHybrid: true,
      OR: [
        { seedParentTaxonId: seedTaxonId, pollenParentTaxonId: pollenTaxonId },
        { seedParentTaxonId: pollenTaxonId, pollenParentTaxonId: seedTaxonId },
      ],
    },
  });
  return {
    knownHybridExists: grexes.length > 0,
    registeredGrexCount: grexes.length,
  };
}

/** Intervention outcome history keyed by intervention type. */
export async function getInterventionHistory(
  prisma: PrismaClient = defaultPrisma,
): Promise<Partial<Record<InterventionType, OutcomeSummary>>> {
  const interventions = await prisma.intervention.findMany();
  const byType = new Map<string, OutcomeRecord[]>();
  for (const iv of interventions) {
    const success =
      iv.outcome === "SUCCESS"
        ? true
        : iv.outcome === "FAILURE"
          ? false
          : iv.outcome === "PARTIAL"
            ? true
            : null;
    const list = byType.get(iv.type) ?? [];
    list.push({ id: iv.id, success });
    byType.set(iv.type, list);
  }
  const result: Partial<Record<InterventionType, OutcomeSummary>> = {};
  for (const [type, records] of byType) {
    result[type as InterventionType] = summarizeOutcomes(records);
  }
  return result;
}

/** Culture records for a taxon plus its genus siblings, shaped for the engine. */
export async function getCultureRecords(
  taxonId: string,
  genusId: string | null | undefined,
  prisma: PrismaClient = defaultPrisma,
): Promise<CultureRecord[]> {
  // Direct records + records for any taxon sharing the genus. We resolve each
  // observation's genus lazily via the plant/taxon it references.
  const observations = await prisma.cultureObservation.findMany({
    include: { taxon: true },
  });

  // Precompute genus for taxa we encounter.
  const genusCache = new Map<string, string | null>();
  const genusOf = async (tid: string): Promise<string | null> => {
    if (genusCache.has(tid)) return genusCache.get(tid)!;
    const info = await buildTaxonInfo(tid, prisma);
    const g = info?.genusId ?? null;
    genusCache.set(tid, g);
    return g;
  };

  const records: CultureRecord[] = [];
  for (const o of observations) {
    const tid = o.taxonId ?? o.taxon?.id ?? null;
    if (!tid) continue;
    const g = await genusOf(tid);
    const relevant = tid === taxonId || (genusId != null && g === genusId);
    if (!relevant) continue;
    records.push({
      id: o.id,
      taxonId: tid,
      genusId: g,
      parameter: o.parameter,
      valueText: o.valueText,
      outcome: o.outcome,
      sourceType: o.sourceType === "LITERATURE" ? "LITERATURE" : "OBSERVATION",
    });
  }
  return records;
}
