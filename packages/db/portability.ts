// Full data portability — export the whole instance to JSON and restore it.
// This is what makes DontCrossMe forkable: anyone can lift their data out and
// drop it into their own copy. Also underpins the CSV import for bulk entry.

import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client";

export interface ExportBundle {
  version: 1;
  exportedAt: string;
  data: Record<string, unknown[]>;
  knowledgeSourceLinks: { knowledgeItemId: string; sourceId: string }[];
}

// Order matters for import (parents before children).
const TABLES = [
  "organization",
  "user",
  "grower",
  "taxon",
  "plant",
  "cross",
  "pollinationEvent",
  "podSet",
  "seedBatch",
  "germinationResult",
  "seedlingBatch",
  "bloomEvent",
  "intervention",
  "source",
  "knowledgeItem",
  "cultureObservation",
  "assessment",
  "intakeSubmission",
] as const;

export async function exportAll(
  prisma: PrismaClient = defaultPrisma,
): Promise<ExportBundle> {
  const data: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    // @ts-expect-error dynamic table access
    data[table] = await prisma[table].findMany();
  }
  const kitems = await prisma.knowledgeItem.findMany({
    select: { id: true, sources: { select: { id: true } } },
  });
  const knowledgeSourceLinks = kitems.flatMap((k) =>
    k.sources.map((s) => ({ knowledgeItemId: k.id, sourceId: s.id })),
  );
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
    knowledgeSourceLinks,
  };
}

/**
 * Restore a bundle into an EMPTY database (fails loudly on FK collisions rather
 * than silently merging). Run inside a transaction so a bad bundle rolls back.
 */
export async function importAll(
  bundle: ExportBundle,
  prisma: PrismaClient = defaultPrisma,
): Promise<{ imported: Record<string, number> }> {
  if (bundle.version !== 1) {
    throw new Error(`Unsupported export version: ${bundle.version}`);
  }
  const imported: Record<string, number> = {};
  for (const table of TABLES) {
    const rows = bundle.data[table] ?? [];
    for (const row of rows) {
      // @ts-expect-error dynamic table access
      await prisma[table].create({ data: row });
    }
    imported[table] = rows.length;
  }
  for (const link of bundle.knowledgeSourceLinks) {
    await prisma.knowledgeItem.update({
      where: { id: link.knowledgeItemId },
      data: { sources: { connect: { id: link.sourceId } } },
    });
  }
  return { imported };
}

// --- CSV helpers -----------------------------------------------------------

/** Minimal, dependency-free CSV parser (handles quoted fields and commas). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((f) => f !== "")) rows.push(row);
  }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => (obj[h] = (r[idx] ?? "").trim()));
    return obj;
  });
}

/** Serialize rows to CSV. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const header = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const r of rows) lines.push(header.map((h) => esc(r[h])).join(","));
  return lines.join("\n");
}
