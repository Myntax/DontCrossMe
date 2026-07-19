// Bulk taxonomy importer. Ingests a *sanctioned* export (WCVP CSV, a Darwin-Core
// file, or any plain CSV/TSV) and maps it into our synonym-aware taxon model.
//
// It does NOT fetch or scrape any external database — you supply the file. The
// planning half is pure (no DB) and unit-tested; the apply half upserts
// idempotently so re-running an updated export doesn't create duplicates.

import type { PrismaClient } from "@prisma/client";
import { TAXON_RANKS } from "@engine/index";
import { prisma as defaultPrisma } from "./client";
import { parseObject, stringifyObject } from "./json";

export type RawRow = Record<string, string>;

// --- Parsing ---------------------------------------------------------------

/** Parse delimited text (auto-detects comma vs tab from the header if unset). */
export function parseDelimited(text: string, delimiter?: string): RawRow[] {
  const firstLine = text.slice(0, text.indexOf("\n") >= 0 ? text.indexOf("\n") : text.length);
  const delim = delimiter ?? (firstLine.includes("\t") ? "\t" : ",");
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((f) => f !== "")) rows.push(row);
  }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: RawRow = {};
    header.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));
    return obj;
  });
}

// --- Column mapping --------------------------------------------------------

export interface ColumnMap {
  id?: string;
  name?: string;
  rank?: string;
  authority?: string;
  status?: string;
  parentId?: string;
  parentName?: string;
  acceptedId?: string;
  acceptedName?: string;
  chromosomeCount?: string;
  genus?: string;
  family?: string;
}

// Header aliases (lowercased) covering Darwin-Core (dwc:) and WCVP conventions.
const HEADER_ALIASES: Record<keyof ColumnMap, string[]> = {
  id: ["taxonid", "plant_name_id", "id", "kew_id", "ipni_id"],
  name: ["scientificname", "taxon_name", "name", "canonicalname", "fullname"],
  rank: ["taxonrank", "taxon_rank", "rank"],
  authority: ["scientificnameauthorship", "authorship", "authority", "taxon_authors", "primary_author"],
  status: ["taxonomicstatus", "taxon_status", "status"],
  parentId: ["parentnameusageid", "parent_plant_name_id", "parentid"],
  parentName: ["parentnameusage", "parent_name", "parentname"],
  acceptedId: ["acceptednameusageid", "accepted_plant_name_id", "acceptedid"],
  acceptedName: ["acceptednameusage", "accepted_name", "acceptedname"],
  chromosomeCount: ["chromosomecount", "chromosome_count", "2n", "chromosome_number"],
  genus: ["genus"],
  family: ["family"],
};

export function detectColumnMap(headers: string[]): ColumnMap {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const map: ColumnMap = {};
  for (const field of Object.keys(HEADER_ALIASES) as (keyof ColumnMap)[]) {
    for (const alias of HEADER_ALIASES[field]) {
      const idx = lower.indexOf(alias);
      if (idx >= 0) {
        map[field] = headers[idx];
        break;
      }
    }
  }
  return map;
}

// --- Normalization ---------------------------------------------------------

const RANK_ALIASES: Record<string, string> = {
  family: "FAMILY",
  subfamily: "SUBFAMILY",
  tribe: "TRIBE",
  subtribe: "SUBTRIBE",
  genus: "GENUS",
  nothogenus: "GENUS",
  species: "SPECIES",
  nothospecies: "SPECIES",
  subspecies: "SPECIES",
  subsp: "SPECIES",
  variety: "SPECIES",
  var: "SPECIES",
  form: "SPECIES",
  f: "SPECIES",
  grex: "GREX",
  cultivar: "CULTIVAR",
};

export function normalizeRank(raw: string | undefined): string | null {
  const k = (raw ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (RANK_ALIASES[k]) return RANK_ALIASES[k];
  const up = (raw ?? "").trim().toUpperCase();
  if ((TAXON_RANKS as readonly string[]).includes(up)) return up;
  return null;
}

export function normalizeStatus(raw: string | undefined): "ACCEPTED" | "SYNONYM" | "DEPRECATED" {
  const k = (raw ?? "").trim().toLowerCase();
  if (!k || k.startsWith("accept")) return "ACCEPTED";
  if (k.startsWith("syn") || k.includes("homotypic") || k.includes("heterotypic")) return "SYNONYM";
  if (k.includes("unplaced") || k.includes("illegit") || k.includes("invalid") || k.startsWith("deprecat"))
    return "DEPRECATED";
  return "ACCEPTED";
}

function parseChromosome(raw: string): number | undefined {
  const m = raw.match(/\d+/);
  return m ? Number(m[0]) : undefined;
}

// --- Planning (pure) -------------------------------------------------------

export interface PlannedTaxon {
  importId?: string;
  name: string;
  rank: string;
  authority?: string;
  status: string;
  parentRef?: { id?: string; name?: string };
  acceptedRef?: { id?: string; name?: string };
  chromosomeCount?: number;
}

export interface ImportPlan {
  taxa: PlannedTaxon[];
  warnings: string[];
  stats: { rows: number; planned: number; skipped: number; synonyms: number };
}

export function planImport(rows: RawRow[], map: ColumnMap): ImportPlan {
  const taxa: PlannedTaxon[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  let synonyms = 0;
  const get = (r: RawRow, col?: string) => (col ? (r[col] ?? "").trim() : "");

  rows.forEach((r, i) => {
    const name = get(r, map.name);
    if (!name) {
      skipped++;
      if (warnings.length < 50) warnings.push(`Row ${i + 1}: missing name; skipped.`);
      return;
    }
    let rank = normalizeRank(get(r, map.rank));
    if (!rank && map.genus && get(r, map.genus).toLowerCase() === name.toLowerCase()) {
      rank = "GENUS"; // a bare genus row
    }
    if (!rank) {
      skipped++;
      if (warnings.length < 50)
        warnings.push(`Row ${i + 1} (${name}): unrecognized rank "${get(r, map.rank)}"; skipped.`);
      return;
    }
    const status = normalizeStatus(get(r, map.status));
    if (status === "SYNONYM") synonyms++;

    let parentRef: PlannedTaxon["parentRef"];
    const pId = get(r, map.parentId);
    const pName = get(r, map.parentName);
    if (pId || pName) parentRef = { id: pId || undefined, name: pName || undefined };
    else if (rank === "SPECIES" && map.genus && get(r, map.genus))
      parentRef = { name: get(r, map.genus) };
    else if (rank === "GENUS" && map.family && get(r, map.family))
      parentRef = { name: get(r, map.family) };

    let acceptedRef: PlannedTaxon["acceptedRef"];
    const aId = get(r, map.acceptedId);
    const aName = get(r, map.acceptedName);
    if (status !== "ACCEPTED" && (aId || aName))
      acceptedRef = { id: aId || undefined, name: aName || undefined };

    taxa.push({
      importId: get(r, map.id) || undefined,
      name,
      rank,
      authority: get(r, map.authority) || undefined,
      status,
      parentRef,
      acceptedRef,
      chromosomeCount: parseChromosome(get(r, map.chromosomeCount)),
    });
  });

  return { taxa, warnings, stats: { rows: rows.length, planned: taxa.length, skipped, synonyms } };
}

// --- Apply (DB, idempotent) ------------------------------------------------

export interface ApplyOptions {
  referenceDatabaseId?: string;
  referenceDatabaseName?: string;
  organizationId?: string;
  dryRun?: boolean;
  prisma?: PrismaClient;
}

export interface ApplyResult {
  dryRun: boolean;
  created: number;
  updated: number;
  namesAdded: number;
  parentsLinked: number;
  synonymsLinked: number;
  unresolvedRefs: string[];
}

function nameRankKey(name: string, rank: string) {
  return `${name.trim().toLowerCase()}::${rank}`;
}

export async function applyImport(
  plan: ImportPlan,
  opts: ApplyOptions = {},
): Promise<ApplyResult> {
  const prisma = opts.prisma ?? defaultPrisma;
  const dryRun = opts.dryRun ?? false;
  const result: ApplyResult = {
    dryRun,
    created: 0,
    updated: 0,
    namesAdded: 0,
    parentsLinked: 0,
    synonymsLinked: 0,
    unresolvedRefs: [],
  };

  const existing = await prisma.taxon.findMany({
    select: { id: true, name: true, rank: true, externalRefsJson: true },
  });
  // Lookups into the DB (and, as we go, newly-created rows).
  const byImportId = new Map<string, string>();
  const byNameRank = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const t of existing) {
    byNameRank.set(nameRankKey(t.name, t.rank), t.id);
    byName.set(t.name.trim().toLowerCase(), t.id);
    const refs = parseObject<Record<string, string>>(t.externalRefsJson);
    if (refs?.importId) byImportId.set(refs.importId, t.id);
  }

  const resolveExisting = (p: PlannedTaxon): string | undefined =>
    (p.importId && byImportId.get(p.importId)) || byNameRank.get(nameRankKey(p.name, p.rank));

  // Pass 1 — upsert every taxon (scalar fields only).
  for (const p of plan.taxa) {
    const found = resolveExisting(p);
    if (dryRun) {
      if (found) {
        result.updated++;
        // Register so pass-2 ref resolution (by import id) reports accurately.
        if (p.importId) byImportId.set(p.importId, found);
      } else {
        result.created++;
        // register provisional id so pass-2 resolution can report accurately
        byNameRank.set(nameRankKey(p.name, p.rank), `new:${p.name}`);
        byName.set(p.name.trim().toLowerCase(), `new:${p.name}`);
        if (p.importId) byImportId.set(p.importId, `new:${p.name}`);
      }
      continue;
    }
    const externalRefsJson = stringifyObject(
      p.importId ? { importId: p.importId, ...(opts.referenceDatabaseName ? { source: opts.referenceDatabaseName } : {}) } : {},
    );
    if (found) {
      await prisma.taxon.update({
        where: { id: found },
        data: {
          authority: p.authority ?? undefined,
          chromosomeCount: p.chromosomeCount ?? undefined,
        },
      });
      result.updated++;
      if (p.importId) byImportId.set(p.importId, found);
      byNameRank.set(nameRankKey(p.name, p.rank), found);
      byName.set(p.name.trim().toLowerCase(), found);
    } else {
      const created = await prisma.taxon.create({
        data: {
          name: p.name,
          rank: p.rank,
          authority: p.authority,
          status: p.status,
          chromosomeCount: p.chromosomeCount,
          organizationId: opts.organizationId,
          externalRefsJson,
          names: { create: { name: p.name, nameType: "ACCEPTED_SCIENTIFIC" } },
        },
      });
      result.created++;
      result.namesAdded++;
      if (p.importId) byImportId.set(p.importId, created.id);
      byNameRank.set(nameRankKey(p.name, p.rank), created.id);
      byName.set(p.name.trim().toLowerCase(), created.id);
    }
  }

  // Pass 2 — link parents and synonym→accepted relations.
  for (const p of plan.taxa) {
    const selfId = resolveExisting(p);
    const resolveRef = (ref?: { id?: string; name?: string }): string | undefined => {
      if (!ref) return undefined;
      if (ref.id && byImportId.get(ref.id)) return byImportId.get(ref.id);
      if (ref.name && byName.get(ref.name.trim().toLowerCase()))
        return byName.get(ref.name.trim().toLowerCase());
      return undefined;
    };

    const parentId = resolveRef(p.parentRef);
    if (p.parentRef && !parentId && result.unresolvedRefs.length < 50)
      result.unresolvedRefs.push(`${p.name}: parent "${p.parentRef.name ?? p.parentRef.id}" not found`);
    const acceptedId = resolveRef(p.acceptedRef);
    if (p.acceptedRef && !acceptedId && result.unresolvedRefs.length < 50)
      result.unresolvedRefs.push(`${p.name}: accepted "${p.acceptedRef.name ?? p.acceptedRef.id}" not found`);

    if (parentId && !parentId.startsWith("new:")) result.parentsLinked++;
    if (acceptedId && !acceptedId.startsWith("new:")) result.synonymsLinked++;

    if (dryRun || !selfId || selfId.startsWith("new:")) continue;
    const data: Record<string, unknown> = {};
    if (parentId && !parentId.startsWith("new:") && parentId !== selfId) data.parentId = parentId;
    if (p.status === "SYNONYM" && acceptedId && !acceptedId.startsWith("new:") && acceptedId !== selfId) {
      data.status = "SYNONYM";
      data.acceptedTaxonId = acceptedId;
    }
    if (Object.keys(data).length > 0) {
      await prisma.taxon.update({ where: { id: selfId }, data });
    }
  }

  return result;
}

/** Convenience: parse text → detect columns → plan → apply. */
export async function importTaxaFromText(
  text: string,
  opts: ApplyOptions & { delimiter?: string; columnMap?: ColumnMap } = {},
): Promise<{ plan: ImportPlan; result: ApplyResult; columnMap: ColumnMap }> {
  const rows = parseDelimited(text, opts.delimiter);
  const columnMap = opts.columnMap ?? detectColumnMap(Object.keys(rows[0] ?? {}));
  const plan = planImport(rows, columnMap);
  const result = await applyImport(plan, opts);
  return { plan, result, columnMap };
}
