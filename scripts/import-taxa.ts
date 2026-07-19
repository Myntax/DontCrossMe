// CLI: bulk-import taxonomy from a sanctioned CSV / TSV / Darwin-Core export.
//
//   npm run import-taxa -- --file path/to/wcvp.csv [--ref-db "Kew POWO / WCVP"]
//                          [--dry-run] [--delimiter "\t"] [--org org_default]
//
// It never fetches or scrapes anything — you supply the file. Idempotent: safe to
// re-run with an updated export.

import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import {
  parseDelimited,
  detectColumnMap,
  planImport,
  applyImport,
} from "../packages/db/taxon-import";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const file = arg("file");
  if (!file) {
    console.error("Usage: npm run import-taxa -- --file <path> [--ref-db <name>] [--dry-run] [--delimiter <d>] [--org <id>]");
    process.exit(1);
  }
  const dryRun = flag("dry-run");
  const delimiter = arg("delimiter")?.replace("\\t", "\t");
  const org = arg("org") ?? "org_default";
  const refDbName = arg("ref-db");

  let refDbId: string | undefined;
  if (refDbName) {
    const db = await prisma.referenceDatabase.findUnique({ where: { name: refDbName } });
    if (!db) {
      console.error(`Reference database "${refDbName}" not found. Register it first (Reference databases page) or omit --ref-db.`);
      process.exit(1);
    }
    refDbId = db.id;
  }

  const text = readFileSync(file, "utf8");
  const rows = parseDelimited(text, delimiter);
  const columnMap = detectColumnMap(Object.keys(rows[0] ?? {}));
  const plan = planImport(rows, columnMap);

  console.log(`File: ${file}`);
  console.log(`Detected columns:`, columnMap);
  console.log(`Rows: ${plan.stats.rows} · planned: ${plan.stats.planned} · skipped: ${plan.stats.skipped} · synonyms: ${plan.stats.synonyms}`);
  if (plan.warnings.length) {
    console.log(`Warnings (first ${Math.min(plan.warnings.length, 10)}):`);
    plan.warnings.slice(0, 10).forEach((w) => console.log(`  - ${w}`));
  }

  const result = await applyImport(plan, {
    prisma,
    dryRun,
    organizationId: org,
    referenceDatabaseId: refDbId,
    referenceDatabaseName: refDbName,
  });

  console.log(dryRun ? "\n[DRY RUN — no changes written]" : "\nApplied:");
  console.log(`  created: ${result.created} · updated: ${result.updated} · names added: ${result.namesAdded}`);
  console.log(`  parents linked: ${result.parentsLinked} · synonyms linked: ${result.synonymsLinked}`);
  if (result.unresolvedRefs.length) {
    console.log(`  unresolved refs (first ${Math.min(result.unresolvedRefs.length, 10)}):`);
    result.unresolvedRefs.slice(0, 10).forEach((u) => console.log(`    - ${u}`));
  }
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
