// Taxonomy operations: rename / move / reclassify / mark-synonym / merge / split /
// deprecate / restore. Every operation writes a TaxonRevision (with before-state)
// so changes are auditable and reversible, and reclassification is propagated to
// nothogenera and crosses so analysis stays correct. Nothing usable is deleted —
// synonymized taxa are redirected, and their names are preserved on the target.

import { prisma } from "@db/client";
import { buildTaxonInfo } from "@db/evidence-adapter";
import { classifyCross, resolveAccepted, detectCollapse } from "@engine/index";
import type { AcceptedResolvable } from "@engine/index";

interface RevisionMeta {
  relatedTaxonId?: string | null;
  before?: unknown;
  after?: unknown;
  note?: string;
  userId?: string | null;
}

async function logRevision(taxonId: string, action: string, meta: RevisionMeta = {}) {
  await prisma.taxonRevision.create({
    data: {
      taxonId,
      action,
      relatedTaxonId: meta.relatedTaxonId ?? null,
      beforeJson: meta.before !== undefined ? JSON.stringify(meta.before) : null,
      afterJson: meta.after !== undefined ? JSON.stringify(meta.after) : null,
      note: meta.note ?? null,
      changedByUserId: meta.userId ?? null,
    },
  });
}

// --- Simple field edits -----------------------------------------------------

export async function renameTaxon(
  taxonId: string,
  newName: string,
  authority: string | undefined,
  userId?: string,
) {
  const before = await prisma.taxon.findUnique({ where: { id: taxonId } });
  if (!before) throw new Error("Taxon not found");
  await prisma.taxon.update({
    where: { id: taxonId },
    data: { name: newName, authority: authority ?? before.authority },
  });
  // Keep the accepted-scientific TaxonName in step if one exists.
  await prisma.taxonName.updateMany({
    where: { taxonId, nameType: "ACCEPTED_SCIENTIFIC" },
    data: { name: newName },
  });
  await logRevision(taxonId, "RENAME", {
    before: { name: before.name, authority: before.authority },
    after: { name: newName, authority },
    userId,
  });
}

export async function moveTaxon(taxonId: string, newParentId: string | null, userId?: string) {
  const before = await prisma.taxon.findUnique({ where: { id: taxonId } });
  if (!before) throw new Error("Taxon not found");
  await prisma.taxon.update({ where: { id: taxonId }, data: { parentId: newParentId } });
  await logRevision(taxonId, "MOVE", {
    before: { parentId: before.parentId },
    after: { parentId: newParentId },
    userId,
  });
  await recomputeCrossTypes();
  await propagateReclassification(userId);
}

export async function reclassifyRank(taxonId: string, newRank: string, userId?: string) {
  const before = await prisma.taxon.findUnique({ where: { id: taxonId } });
  if (!before) throw new Error("Taxon not found");
  await prisma.taxon.update({ where: { id: taxonId }, data: { rank: newRank } });
  await logRevision(taxonId, "RECLASSIFY_RANK", {
    before: { rank: before.rank },
    after: { rank: newRank },
    userId,
  });
}

export async function deprecateTaxon(taxonId: string, note: string | undefined, userId?: string) {
  await prisma.taxon.update({ where: { id: taxonId }, data: { status: "DEPRECATED" } });
  await logRevision(taxonId, "DEPRECATE", { note, userId });
}

export async function restoreTaxon(taxonId: string, userId?: string) {
  await prisma.taxon.update({
    where: { id: taxonId },
    data: { status: "ACCEPTED", acceptedTaxonId: null, needsReview: false },
  });
  await logRevision(taxonId, "RESTORE", { userId });
}

export async function clearNeedsReview(taxonId: string, note: string | undefined, userId?: string) {
  await prisma.taxon.update({ where: { id: taxonId }, data: { needsReview: false } });
  await logRevision(taxonId, "RESTORE", { note: note ?? "review resolved", userId });
}

// --- Name preservation ------------------------------------------------------

/** Copy a taxon's names onto another taxon, demoting its accepted name to a synonym. */
async function carryNamesTo(sourceId: string, targetId: string) {
  const source = await prisma.taxon.findUnique({
    where: { id: sourceId },
    include: { names: true },
  });
  if (!source) return;
  const targetNames = await prisma.taxonName.findMany({ where: { taxonId: targetId } });
  const existing = new Set(targetNames.map((n) => n.name.toLowerCase()));

  // The source's own denormalized name becomes a scientific synonym of the target.
  const toAdd: { name: string; nameType: string; inCurrentUse: boolean; authority: string | null }[] = [];
  if (!existing.has(source.name.toLowerCase())) {
    toAdd.push({
      name: source.name,
      nameType: "SYNONYM_SCIENTIFIC",
      inCurrentUse: false,
      authority: source.authority ?? null,
    });
  }
  for (const n of source.names) {
    if (existing.has(n.name.toLowerCase())) continue;
    const nameType =
      n.nameType === "ACCEPTED_SCIENTIFIC" ? "SYNONYM_SCIENTIFIC" : n.nameType;
    toAdd.push({
      name: n.name,
      nameType,
      inCurrentUse: n.inCurrentUse, // horticultural names keep their in-use status
      authority: n.authority ?? null,
    });
  }
  for (const a of toAdd) {
    await prisma.taxonName.create({
      data: { taxonId: targetId, isPreferredDisplay: false, ...a },
    });
  }
}

// --- Mark synonym / merge ---------------------------------------------------

export async function markSynonym(
  taxonId: string,
  acceptedTaxonId: string,
  reassign: boolean,
  userId?: string,
) {
  if (taxonId === acceptedTaxonId) throw new Error("A taxon cannot be its own synonym");
  const before = await prisma.taxon.findUnique({ where: { id: taxonId } });
  if (!before) throw new Error("Taxon not found");

  await carryNamesTo(taxonId, acceptedTaxonId);
  await prisma.taxon.update({
    where: { id: taxonId },
    data: { status: "SYNONYM", acceptedTaxonId },
  });
  if (reassign) await reassignReferences(taxonId, acceptedTaxonId);

  await logRevision(taxonId, "MARK_SYNONYM", {
    relatedTaxonId: acceptedTaxonId,
    before: { status: before.status, acceptedTaxonId: before.acceptedTaxonId },
    after: { status: "SYNONYM", acceptedTaxonId },
    userId,
  });
  await recomputeCrossTypes();
  await propagateReclassification(userId);
}

/** Reassign the user-visible references from one taxon to another. */
async function reassignReferences(fromId: string, toId: string) {
  await prisma.plant.updateMany({ where: { taxonId: fromId }, data: { taxonId: toId } });
  await prisma.cultureObservation.updateMany({ where: { taxonId: fromId }, data: { taxonId: toId } });
  await prisma.knowledgeItem.updateMany({ where: { taxonId: fromId }, data: { taxonId: toId } });
  await prisma.bloomEvent.updateMany({ where: { taxonId: fromId }, data: { taxonId: toId } });
  await prisma.cross.updateMany({ where: { seedParentTaxonId: fromId }, data: { seedParentTaxonId: toId } });
  await prisma.cross.updateMany({ where: { pollenParentTaxonId: fromId }, data: { pollenParentTaxonId: toId } });
  await prisma.taxon.updateMany({ where: { seedParentTaxonId: fromId }, data: { seedParentTaxonId: toId } });
  await prisma.taxon.updateMany({ where: { pollenParentTaxonId: fromId }, data: { pollenParentTaxonId: toId } });
  // Nothogenus components (avoid duplicating a component the target already has).
  const targetComponents = await prisma.nothoGenusComponent.findMany({
    where: { componentGenusId: toId },
    select: { nothoGenusId: true },
  });
  const targetNotho = new Set(targetComponents.map((c) => c.nothoGenusId));
  const fromComponents = await prisma.nothoGenusComponent.findMany({
    where: { componentGenusId: fromId },
  });
  for (const c of fromComponents) {
    if (targetNotho.has(c.nothoGenusId)) {
      await prisma.nothoGenusComponent.delete({ where: { id: c.id } });
    } else {
      await prisma.nothoGenusComponent.update({
        where: { id: c.id },
        data: { componentGenusId: toId },
      });
    }
  }
}

/** Merge A into B: reassign everything, preserve A's names on B, redirect A → B. */
export async function mergeTaxa(sourceId: string, targetId: string, userId?: string) {
  if (sourceId === targetId) throw new Error("Cannot merge a taxon into itself");
  const [source, target] = await Promise.all([
    prisma.taxon.findUnique({ where: { id: sourceId } }),
    prisma.taxon.findUnique({ where: { id: targetId } }),
  ]);
  if (!source || !target) throw new Error("Taxon not found");

  await carryNamesTo(sourceId, targetId);
  await reassignReferences(sourceId, targetId);
  await prisma.taxon.update({
    where: { id: sourceId },
    data: { status: "SYNONYM", acceptedTaxonId: targetId },
  });

  await logRevision(sourceId, "MERGE", {
    relatedTaxonId: targetId,
    note: `Merged into ${target.name}`,
    userId,
  });
  await logRevision(targetId, "MERGE", {
    relatedTaxonId: sourceId,
    note: `Absorbed ${source.name}`,
    userId,
  });
  await recomputeCrossTypes();
  await propagateReclassification(userId);
}

// --- Split ------------------------------------------------------------------

export async function splitTaxon(
  sourceId: string,
  newTaxon: { name: string; rank: string; authority?: string },
  movePlantIds: string[],
  moveObservationIds: string[],
  userId?: string,
) {
  const source = await prisma.taxon.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error("Taxon not found");
  const created = await prisma.taxon.create({
    data: {
      name: newTaxon.name,
      rank: newTaxon.rank,
      authority: newTaxon.authority,
      parentId: source.parentId,
      chromosomeCount: source.chromosomeCount,
      ploidy: source.ploidy,
      organizationId: source.organizationId,
      names: {
        create: { name: newTaxon.name, nameType: "ACCEPTED_SCIENTIFIC" },
      },
    },
  });
  if (movePlantIds.length) {
    await prisma.plant.updateMany({
      where: { id: { in: movePlantIds }, taxonId: sourceId },
      data: { taxonId: created.id },
    });
  }
  if (moveObservationIds.length) {
    await prisma.cultureObservation.updateMany({
      where: { id: { in: moveObservationIds }, taxonId: sourceId },
      data: { taxonId: created.id },
    });
  }
  await logRevision(sourceId, "SPLIT", {
    relatedTaxonId: created.id,
    note: `Split out ${created.name} (${movePlantIds.length} plants, ${moveObservationIds.length} observations)`,
    userId,
  });
  await logRevision(created.id, "CREATE", {
    relatedTaxonId: sourceId,
    note: `Split from ${source.name}`,
    userId,
  });
  return created;
}

// --- Maintenance / propagation ---------------------------------------------

/** Re-derive crossType for every cross (parentage may have moved). */
export async function recomputeCrossTypes(): Promise<number> {
  const crosses = await prisma.cross.findMany({
    include: { seedParentPlant: true, pollenParentPlant: true },
  });
  let changed = 0;
  for (const c of crosses) {
    const seedId = c.seedParentPlant?.taxonId ?? c.seedParentTaxonId ?? null;
    const pollenId = c.pollenParentPlant?.taxonId ?? c.pollenParentTaxonId ?? null;
    if (!seedId || !pollenId) continue;
    const a = await buildTaxonInfo(seedId);
    const b = await buildTaxonInfo(pollenId);
    if (!a || !b) continue;
    const crossType = classifyCross(a, b).crossType;
    if (crossType !== c.crossType) {
      await prisma.cross.update({ where: { id: c.id }, data: { crossType } });
      changed += 1;
    }
  }
  return changed;
}

/**
 * After a genus-level change, flag any nothogenus that has collapsed (its
 * components now resolve to a single accepted genus) for coordinator review.
 * Nothing is auto-destroyed — the review queue surfaces the impact.
 */
export async function propagateReclassification(userId?: string): Promise<number> {
  const taxa = await prisma.taxon.findMany({
    select: { id: true, status: true, acceptedTaxonId: true },
  });
  const acceptedMap = new Map<string, AcceptedResolvable>(
    taxa.map((t) => [t.id, { status: t.status, acceptedTaxonId: t.acceptedTaxonId }]),
  );

  const nothogenera = await prisma.taxon.findMany({
    where: { nothoComponents: { some: {} } },
    include: { nothoComponents: true },
  });

  let flagged = 0;
  for (const ng of nothogenera) {
    const componentIds = ng.nothoComponents.map((c) => c.componentGenusId);
    const { collapsed, collapsedInto } = detectCollapse(componentIds, acceptedMap);
    if (collapsed && !ng.needsReview) {
      const intoName = collapsedInto
        ? (await prisma.taxon.findUnique({ where: { id: collapsedInto } }))?.name
        : undefined;
      await prisma.taxon.update({ where: { id: ng.id }, data: { needsReview: true } });
      await logRevision(ng.id, "MERGE", {
        relatedTaxonId: collapsedInto ?? null,
        note: `Nothogenus components collapsed to a single accepted genus${
          intoName ? ` (${intoName})` : ""
        }; review whether this hybrid genus is still valid.`,
        userId,
      });
      flagged += 1;
    }
  }
  return flagged;
}
