# Bulk taxonomy import

Load real orchid taxonomy from a **sanctioned export** you provide — a WCVP CSV, a
Darwin-Core file, or any plain CSV/TSV. The importer maps rows into the synonym-aware
taxon model, links synonyms to their accepted names, builds parentage, and attributes
the data to a reference database.

> **It never fetches or scrapes anything.** You supply the file. Only import exports you
> are licensed to use (e.g. Kew's WCVP data download under CC-BY). See
> [`LICENSING.md`](LICENSING.md).

## Quick start (CLI)

```bash
# Dry run first — reports what would change, writes nothing:
npm run import-taxa -- --file examples/taxa-sample.csv --dry-run

# Apply, attributing to a registered reference database:
npm run import-taxa -- --file examples/taxa-sample.csv --ref-db "Kew POWO / WCVP"
```

Flags: `--file <path>` (required), `--ref-db <name>` (must be registered on the
Reference databases page first), `--dry-run`, `--delimiter "\t"` (for TSV/Darwin-Core;
auto-detected otherwise), `--org <organizationId>` (default `org_default`).

You can also paste a smaller CSV directly in the UI: **Taxa → Import taxa (CSV)**, which
shows a dry-run report before you apply.

## Columns

Headers are auto-detected (case-insensitive) from Darwin-Core and WCVP conventions:

| Field | Recognized headers |
| --- | --- |
| id | `taxonID`, `plant_name_id`, `id`, `kew_id`, `ipni_id` |
| name | `scientificName`, `taxon_name`, `name`, `canonicalName` |
| rank | `taxonRank`, `taxon_rank`, `rank` |
| authority | `scientificNameAuthorship`, `taxon_authors`, `primary_author` |
| status | `taxonomicStatus`, `taxon_status`, `status` |
| parent (id / name) | `parentNameUsageID` / `parentNameUsage`, `parent_plant_name_id` / `parent_name` |
| accepted (id / name) | `acceptedNameUsageID` / `acceptedNameUsage`, `accepted_plant_name_id` / `accepted_name` |
| chromosomeCount | `chromosomeCount`, `2n`, `chromosome_number` |
| genus / family | `genus`, `family` |

Only **name** and **rank** are strictly required. If no explicit parent column is
present, a **species** row's parent is derived from its `genus` column and a **genus**
row's parent from its `family` column (matched by name).

- **Ranks** map to `FAMILY | SUBFAMILY | TRIBE | SUBTRIBE | GENUS | SPECIES | GREX |
  CULTIVAR`; infra-specific ranks (subspecies, variety, form) fold to `SPECIES`.
- **Status** maps `Accepted → ACCEPTED`, `Synonym`/`*_Synonym → SYNONYM`,
  `Unplaced`/`Invalid` → `DEPRECATED`. Synonyms are linked to the taxon named by their
  accepted id/name, so analysis resolves through them.

## Idempotency

Rows are matched to existing taxa by their import id (stored in `externalRefsJson`) or by
name+rank, so **re-running an updated export updates in place** rather than duplicating.

## Two-pass linking

The importer creates all taxa first, then links parents and synonym→accepted relations,
so references to rows further down the file resolve correctly. Unresolved references
(e.g. a synonym whose accepted taxon isn't in the file or the DB) are reported, not
guessed.
