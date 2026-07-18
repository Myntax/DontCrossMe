# Architecture

DontCrossMe is a single self-hostable Next.js app with a strict internal separation
that guarantees the product works with AI fully disabled.

```
app/                      Next.js App Router (UI + route handlers + server actions)
  (app)/                  authenticated coordinator hub (dashboard, growers, plants,
                          taxa, crosses, culture log, suggestions, knowledge, review)
  intake/                 PUBLIC, account-less member submission form
  api/{export,import}/    data portability endpoints
packages/
  engine/                 PURE deterministic core — no DB, no AI imports
    taxonomy.ts           cross classification & taxonomic distance
    evidence.ts           Wilson lower bound, confidence, outcome summaries
    viability.ts          cross-viability scoring with cited factors
    culture.ts            culture-tip ranking (+ genus inference)
    interventions.ts      intervention catalog + evidence-based re-ranking
  ai/                     OPTIONAL layer over the engine's output
    provider.ts           AiProvider interface
    null-provider.ts      default: composes engine output locally (no network)
    anthropic-provider.ts opt-in Claude synthesis (rephrase only)
    licensing-gate.ts     the single chokepoint for what may reach a model
  db/                     Prisma client, JSON helpers, portability, evidence-adapter
src/lib/                  auth, session, config, validation (Zod), suggestion service
prisma/schema.prisma      the domain model (portable across SQLite & Postgres)
```

## The key boundary

`packages/engine` imports **nothing** from the database or the AI layer. It operates on
plain data structures (`TaxonInfo`, `OutcomeSummary`, `CultureRecord`, …). Two thin
adapters surround it:

- **`packages/db/evidence-adapter.ts`** reads Prisma rows and produces those plain
  structures (resolving genus/subtribe by walking the taxon hierarchy, summarising
  outcomes into success rates, etc.).
- **`packages/ai`** takes the engine's *finished, cited* output and optionally rephrases
  it. `getAiProvider()` returns the deterministic `NullProvider` unless AI is explicitly
  enabled **and** an API key is present.

The suggestion service (`src/lib/suggestions.ts`) wires them together:
`DB rows → adapter → pure engine → (optional) AI narrative`.

## Learning without AI

Outcomes are binary evidence records. `evidence.ts` computes a **Wilson score interval
lower bound** (conservative with small samples, tightening as data grows) plus a coarse
confidence label from sample size. Viability blends a taxonomic baseline with
ploidy/precedent factors and empirical outcome factors that use **sample-size shrinkage**
(`rate` scaled by `n/(n+k)`), so successes always nudge up and failures down, with
magnitude proportional to how much you've actually observed. Culture tips and intervention
rankings work the same way. Every number is explained in the UI.

## Data-model notes (portability)

The schema targets both SQLite (default) and Postgres. To stay portable it avoids two
Prisma features SQLite lacks:

- **Enums** → plain `String` columns; allowed values live in `packages/engine/enums.ts`
  and are enforced by Zod (`src/lib/validation.ts`).
- **Scalar list / Json columns** → JSON-encoded `String` columns (suffixed `*Json`),
  parsed via `packages/db/json.ts`.

`Taxon` is a self-referential hierarchy (family → … → species) and also models hybrid
grexes via `seedParentTaxonId` / `pollenParentTaxonId`. A `Cross` may reference specific
`Plant`s or, when the exact plant is unknown, taxa directly.
