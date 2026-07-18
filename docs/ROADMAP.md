# Roadmap

## Phase 1 — shipped (this build)

A working vertical slice:

- Portable domain model (SQLite/Postgres) + seed.
- Coordinator hub: growers, plants, taxa, crosses, culture log, outcome logging.
- Deterministic engine: cross-viability, culture tips (with genus inference),
  intervention suggestions — all cited, with confidence, unit-tested.
- Optional, off-by-default AI layer with a per-source licensing gate.
- Account-less member intake + coordinator review queue.
- JSON export/import for backup and forking.
- Minimal single-coordinator auth with the role model in place.

## Phase 2 — platform & ingestion

- Full member **accounts & roles** UI (the `User`/`Role`/`Grower.userId` groundwork
  already exists).
- Richer intake: email-to-import; promoting `CROSS`/`PLANT` submissions automatically.
- **Assisted external-source capture** workflows for POWO/WCVP (sanctioned data access),
  and structured manual capture for RHS Register parentage and IOSPE/AOS culture data —
  each stored with provenance and licensing flags.
- Semantic search over takeaways (`pgvector`) to power better retrieval + AI grounding.
- AI-assisted *drafting* of takeaways from user-provided text (licensing-gated).

## Phase 3 — analytics & scale

- Outcome dashboards and trend analytics.
- ML models trained on accumulated program outcomes for viability prediction.
- Multi-tenant organization mode (the nullable `organizationId` is the seam).
- Public read APIs.
