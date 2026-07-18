// CLI: dump the whole instance to exports/dontcrossme-export-<timestamp>.json
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { exportAll } from "../packages/db/portability";

async function main() {
  const bundle = await exportAll();
  const dir = join(process.cwd(), "exports");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `dontcrossme-export-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(bundle, null, 2));
  const counts = Object.entries(bundle.data)
    .map(([k, v]) => `${k}:${v.length}`)
    .join(", ");
  console.log(`Exported to ${file}`);
  console.log(`  ${counts}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
