# DontCrossMe

**A coordinator's hub for a decentralized orchid breeding program** — track crosses,
plants, and growers across a society whose members may or may not use the platform
themselves; capture practical takeaways from literature, databases, and experience;
and get steadily better suggestions for **culture tips**, **cross viability**, and
**interventions to rescue unlikely crosses**.

It learns over time from your own outcomes — with **no AI required**. An optional AI
layer can add fluent narrative on top, but it is **off by default** and is strictly
gated by per-source licensing.

---

## What it does

- **Coordinate a decentralized program.** Growers are *records*, not required logins,
  so you can enter data on anyone's behalf. Willing members contribute through an
  **account-less intake form** that lands in a coordinator **review queue**.
- **Build a knowledge base with provenance.** Every takeaway is a short, paraphrased
  fact tied to a **Source** carrying explicit `aiUseAllowed` / `redistributionAllowed`
  / `commercialUseAllowed` flags. We store facts + citations, never copyrighted text.
- **Evaluate cross viability.** A transparent 1–100 score with **confidence** and a
  fully **cited breakdown**: taxonomic distance, ploidy/chromosome compatibility,
  registered-hybrid precedent, and *your program's own outcomes*.
- **Suggest culture tips for uncommon orchids.** Ranked per parameter with confidence;
  for rare taxa with little direct data it **infers from the genus** (clearly flagged).
- **Suggest interventions for unlikely crosses.** A curated catalog (embryo rescue,
  green-pod flasking, reciprocal crosses, mentor pollen, ploidy conversion, …) ranked
  for the cross, and **re-ranked by what has actually worked in your program**.
- **Own your data.** One-click JSON export/import makes the whole instance portable and
  **forkable** — copy it for another society or as a personal private dashboard.

## How the "learning" works (and why it needs no AI)

Every outcome you log — pod set, pollination take, germination, an intervention result,
a culture win or failure — becomes an **evidence record**. The engine aggregates these
into **confidence-aware success rates** (Wilson lower bounds) and uses sample-size
shrinkage so a single lucky result doesn't overclaim. As evidence accumulates, viability
scores, culture-tip rankings, and intervention rankings tighten and improve — all
deterministic, auditable, and explainable. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## AI is optional and gated

- **Default: fully off.** With `AI_ENABLED` unset, no data ever leaves the machine; the
  app is completely functional and every suggestion is shown with its cited evidence.
- **If enabled**, the AI layer only *rephrases* the engine's already-computed, cited
  output — it never invents facts. A single **licensing gate** decides what evidence may
  reach a model: a takeaway is eligible only if it's your own, or if **every** linked
  source is flagged `aiUseAllowed`. See [`docs/LICENSING.md`](docs/LICENSING.md).

## Quick start

```bash
cp .env.example .env          # then edit ADMIN_EMAIL / ADMIN_PASSWORD / SESSION_SECRET
npm install
npx prisma migrate dev        # creates the SQLite DB and runs the seed
npm run dev                   # http://localhost:3000  → sign in as your admin
```

The seed loads a small taxonomy slice (Cattleya, Laelia, Paphiopedilum), a grower, a
cross with outcomes, sources with contrasting AI rights, and culture observations — so
the suggestions produce meaningful output immediately.

### Useful commands

| Command | What it does |
| --- | --- |
| `npm test` | Run the engine + licensing unit tests (Vitest) |
| `npm run build` | Production build |
| `npm run db:seed` | Re-run the seed (idempotent) |
| `npm run export` | Write a full JSON export to `exports/` |
| `npm run import -- <file>` | Restore an export into an empty DB |

## Forking / self-hosting

- **SQLite by default** — perfect for a personal or single-society instance. For scale,
  switch `provider` in `prisma/schema.prisma` to `postgresql` and point `DATABASE_URL`
  at Postgres.
- Branding is config-driven (`SOCIETY_NAME`); there are no hard-coded society specifics.
- A nullable `organizationId` is present on the core tables from day one, so growing into
  a multi-tenant platform later is a change of scope, not a rewrite.
- `Dockerfile` + `docker-compose.yml` are included for containerized self-hosting.

## Tech

TypeScript · Next.js (App Router) · Prisma (SQLite/Postgres) · Zod · Vitest.
The suggestion engine lives in `packages/engine` and is **pure** — no DB, no AI imports —
which is exactly what guarantees it works with AI disabled and makes it trivial to test.

## Status

This is **Phase 1**: a working vertical slice. Planned next: full member accounts &
roles UI, assisted capture from external databases (POWO/WCVP, RHS, IOSPE), semantic
search, and analytics. See [`docs/ROADMAP.md`](docs/ROADMAP.md).
