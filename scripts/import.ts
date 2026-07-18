// CLI: restore a JSON export into an EMPTY database.
//   npm run import -- path/to/export.json
import { readFileSync } from "fs";
import { importAll, type ExportBundle } from "../packages/db/portability";

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npm run import -- <path-to-export.json>");
    process.exit(1);
  }
  const bundle = JSON.parse(readFileSync(path, "utf8")) as ExportBundle;
  const { imported } = await importAll(bundle);
  console.log("Imported:", imported);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
