# Design: Taxonomic Realism & Extensibility

> Status: **proposed design, not yet implemented.** This document is the agreed plan
> for a follow-up to Phase 1 (see the Phase-1 code in PR #1). It will be built on a
> later branch once approved.

## Why

Orchid nomenclature is a moving target, and horticulture does not always follow botany.
The platform must stay correct and useful as the world changes underneath it:

- **Taxa get reclassified, merged, and split.** Genera are constantly sunk into or
  split out of one another.
- **Names stay in horticultural use after reclassification.** *Neofinetia falcata* was
  folded into *Vanda falcata*, yet "Neofinetia" remains the name growers use — it is
  central to the Japanese Fūkiran tradition. A synonym scientifically can still be the
  living, preferred label culturally.
- **Hybrid genera (nothogenera) are defined by their component genera** — and are
  impacted when those components are reclassified. This covers both simple
  portmanteaus (×*Laeliocattleya* = *Laelia* × *Cattleya*) and honorific condensed
  formulae covering three or more genera (*Fredclarkeara* = *Catasetum* × *Clowesia* ×
  *Mormodes*; *Potinara*; *Colmanara*). When *Sophronitis* and *Laelia* were sunk into
  *Cattleya*, whole nothogenera such as ×*Sophrolaeliocattleya* **collapsed** into
  *Cattleya*, and their intergeneric grexes effectively became intra-generic.

Plus two extensibility needs that keep the tool from going stale:

- **New intervention techniques** can be added as the field develops.
- **New reference databases** can be onboarded as they are discovered.

**Principles:** every change below is **additive and backward-compatible** (new columns
are nullable/defaulted; existing rows untouched), **preserves data** (nothing usable is
ever deleted, only redirected/flagged), and **keeps the engine pure** (all resolution
happens in the DB adapter, so `packages/engine` stays framework/DB/AI-free and
trivially testable).

---

## A. Decouple names from taxa (handles Neofinetia)

Introduce a `TaxonName` table — a taxon has many names:

| field | notes |
| --- | --- |
| `taxonId` | owner taxon |
| `name` | the name string |
| `nameType` | `ACCEPTED_SCIENTIFIC` \| `SYNONYM_SCIENTIFIC` \| `BASIONYM` \| `HORTICULTURAL` \| `TRADE` \| `COMMON` |
| `authority` | optional author citation |
| `inCurrentUse` | still used in practice? |
| `isPreferredDisplay` | promote this name as the display label for this taxon |
| `note` | free text (e.g. tradition, region) |

`Taxon.name` remains as a denormalized convenience holding the current accepted
scientific name, but **search and display resolve through `TaxonName`**.

**Neofinetia example:** the taxon's accepted name is *Vanda falcata*
(`ACCEPTED_SCIENTIFIC`); *Neofinetia falcata* lives as a `HORTICULTURAL` name with
`inCurrentUse = true`. A grower searching "Neofinetia" finds the taxon, and a
Fūkiran-focused instance can set that name `isPreferredDisplay`. **All analysis still
uses the accepted taxon** — only the label changes.

**Display rule (configurable):** default shows the accepted scientific name with any
in-use horticultural name alongside — *"Vanda falcata (hort. Neofinetia falcata)"* —
while `isPreferredDisplay` can promote the horticultural label for communities that
use it.

---

## B. Reclassification with full merge/split (name-aware)

**Schema additions to `Taxon`:** `status` (`ACCEPTED` \| `SYNONYM` \| `DEPRECATED`),
`acceptedTaxonId` (self-relation redirect to the current accepted taxon), `needsReview`
(bool).

**New `TaxonRevision` audit table:** `taxonId`, `action` (`CREATE` \| `RENAME` \|
`MOVE` \| `RECLASSIFY_RANK` \| `MARK_SYNONYM` \| `MERGE` \| `SPLIT` \| `DEPRECATE` \|
`RESTORE`), `relatedTaxonId?`, `beforeJson`, `afterJson`, `note`, `changedByUserId`,
`createdAt`. Every change stores its before-state, so it is auditable and reversible.

**Operations** (server actions + a taxonomy service):

- **Rename / Reclassify rank / Move** (e.g. a species moved to a different genus).
- **Mark synonym of X** — set `status = SYNONYM`, `acceptedTaxonId = X`.
- **Merge A → B** (guided): preview counts of everything attached to A (plants,
  observations, knowledge items, crosses/grexes referencing A as a parent) → confirm →
  reassign those references to B → mark A a synonym of B → log `MERGE` on both.
- **Split A → A + B** (guided): create/select B, then a checkbox list to move a chosen
  subset of A's plants/observations to B → log `SPLIT`.
- **Deprecate / Restore** — soft states with the same audit trail.

**Name-preserving merges:** on merge A → B, A's names are **retained as `TaxonName`
rows on B** (A's accepted name becomes a `SYNONYM_SCIENTIFIC` of B; any horticultural
names carry over with `inCurrentUse` intact). A merge never deletes a usable label.

After any move/merge, run a `recomputeCrossTypes()` pass for affected crosses (cross
type is derived at creation, so it must be re-derived when parentage relationships move).

---

## C. Hybrid genera / nothogenera

A nothogenus is modeled as a `Taxon` of rank `GENUS` with `isHybrid = true`, plus:

- **`NothoGenusComponent`** link table: `nothoGenusId → componentGenusId` (Taxon), the
  set of ancestor genera. ×*Laeliocattleya* → {*Laelia*, *Cattleya*};
  *Fredclarkeara* → {*Catasetum*, *Clowesia*, *Mormodes*}.
- **`Taxon.nothoFormulaType`** (`CONDENSED_PORTMANTEAU` \| `CONDENSED_HONORIFIC` \|
  `null`): portmanteau = name built from the parent genera (Laeliocattleya); honorific =
  named for a person, covering three or more genera (Fredclarkeara, Potinara, Colmanara).
- **`Taxon.formulaAbbreviation`** — the RHS-style abbreviation (e.g. `Lc.`, `Fdk.`).

Grex parentage continues to use seed/pollen parent taxa; a grex's nothogenus is derived
from the genera in its ancestry.

---

## D. Propagation of reclassification to nothogenera & grexes (the hard part)

A `propagateReclassification` service runs after any genus-level merge/move:

1. **Find impact.** Locate every nothogenus whose `NothoGenusComponent` set includes the
   changed genus, and every grex whose ancestry includes it.
2. **Recompute effective components.** Map merged/renamed genera to their accepted genus
   and detect **collapse** — e.g. after *Sophronitis* + *Laelia* → *Cattleya*,
   ×*Sophrolaeliocattleya* collapses to *Cattleya*, and its intergeneric grexes become
   intra-/inter-specific *Cattleya*.
3. **Flag, don't destroy.** Mark affected taxa `needsReview = true` with a
   `TaxonRevision` note describing the impact and a suggested resolution; re-derive
   `crossType` for affected crosses.
4. **Human confirms.** Surface a **"Reclassification impact" review queue** listing the
   affected nothogenera/grexes and the likely new status, so the coordinator decides
   (accept the collapse / re-map / keep the horticultural name). Nothing is auto-deleted.

This is what keeps a component-genus change from silently breaking the data: the system
tells you *exactly* which hybrid genera and grexes are affected and what likely changed.

---

## E. Data-driven intervention techniques

New **`InterventionTechnique`** table: `key` (unique), `label`, `description`,
`appliesToJson` (cross types), `maxViability`, `basePriority`, `isBuiltIn`, `isActive`,
`createdByUserId`, timestamps.

`packages/engine/interventions.ts` refactors so the current hard-coded list becomes
`DEFAULT_INTERVENTION_CATALOG`, and `suggestInterventions(input, catalog?)` accepts the
catalog as a parameter (defaults to built-ins). The logic is unchanged and stays pure.
The adapter's `getInterventionCatalog()` loads active rows; the seed inserts the
built-ins as `isBuiltIn = true`. A **Techniques** management page lets you add/enable
techniques, and the intervention pickers on the cross-detail and suggestions pages read
from the DB — so a new technique is immediately available and starts building its own
success record.

---

## F. Reference-database registry

New **`ReferenceDatabase`** table: `name` (unique), `description?`, `url?`, `kind`
(`TAXONOMY` \| `CULTURE` \| `REGISTER` \| `LITERATURE` \| `OTHER`), default `license`
plus `defaultAiUseAllowed` / `defaultRedistributionAllowed` / `defaultCommercialUseAllowed`,
`captureGuidance` (how to bring data in + terms-of-use notes), `status` (`EVALUATING` \|
`ACTIVE` \| `RETIRED`).

`Source.referenceDatabaseId` links a source to its origin database and **prefills the
licensing flags** from that database's defaults (still editable), keeping the
copyright/AI gate consistent per database. The seed registers POWO/WCVP, the RHS Orchid
Register, and IOSPE/AOS as records with their capture and ToS guidance. Onboarding a
newly-discovered database becomes a data-entry task, not a code change.

---

## Engine / adapter impact (stays pure)

- **`packages/db/evidence-adapter.ts`** — add `resolveAcceptedTaxonId()` plus
  name/accepted resolution; `buildTaxonInfo`, `getCultureRecords`, and `getPairOutcomes`
  map taxon ids through it, so data logged under an old (now-synonym) name still
  aggregates under the accepted taxon.
- **`packages/engine/taxonomy.ts`** — genus resolution becomes nothogenus/merge-aware
  (map component/merged genera → accepted) so intergeneric ↔ interspecific transitions
  compute correctly; add pure `computeEffectiveComponents()` / `detectCollapse()`.
- **`packages/engine/interventions.ts`** — `suggestInterventions(input, catalog?)`.
- All new logic is factored into pure, unit-testable helpers (no DB required to test).

## Schema summary (one migration, `prisma/schema.prisma`)

- `Taxon`: **+** `status`, `acceptedTaxonId`, `nothoFormulaType`, `formulaAbbreviation`,
  `needsReview`.
- **New models:** `TaxonName`, `TaxonRevision`, `NothoGenusComponent`,
  `InterventionTechnique`, `ReferenceDatabase`.
- `Source`: **+** `referenceDatabaseId`.
- Add all new tables to the export/import ordering in `packages/db/portability.ts`.

## UI (representative paths)

- `app/(app)/taxa/…` — names panel (add/flag horticultural names), status/accepted
  display, revision history, nothogenus-components editor, `needsReview` badge, and the
  guided Merge/Split flows.
- New `app/(app)/reclassification-review/…` — the impact review queue.
- New `app/(app)/techniques/…` — intervention-technique management.
- New `app/(app)/reference-databases/…` — the database registry; the Source form gains
  a database picker.

## Tests (Vitest, no DB)

- `resolveAccepted` redirect resolution + cycle guard.
- A horticultural name survives a merge (retained on the target taxon).
- Nothogenus collapse detection (*Sophronitis* + *Laelia* → *Cattleya* collapses
  ×*Sophrolaeliocattleya*; grex cross-type recompute) and component-genus remap.
- `suggestInterventions` honors a custom catalog.

## Verification (when the features are built)

Migrate + seed, then:

1. Reclassify *Neofinetia falcata* as a synonym under *Vanda falcata*; confirm
   "Neofinetia" is still searchable/displayable and that viability/culture resolve to
   *Vanda*.
2. Define ×*Laeliocattleya* (2 components) and *Fredclarkeara* (3 components).
3. Merge a component genus and confirm the impact review queue flags the affected
   nothogenera/grexes and recomputes cross types.
4. Add a custom intervention technique and see it appear in suggestions.
5. Register a reference database and create a Source prefilled from it.
6. Run an export → import round-trip and confirm the new tables travel intact.
