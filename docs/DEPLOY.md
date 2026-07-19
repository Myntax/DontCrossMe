# Deploying DontCrossMe

DontCrossMe is a single self-hostable Next.js app. It runs anywhere you can run a Node
container. Below are the two common paths; both keep your data yours.

## Before you start

Set these (copy `.env.example` → `.env`, or pass as environment variables):

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | SQLite `file:/data/dontcrossme.db` (default) or a Postgres URL |
| `SESSION_SECRET` | **Required.** `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The initial coordinator login (created by the seed) |
| `SOCIETY_NAME` | Branding shown in the UI |
| `AI_ENABLED` | Leave `false` (default). Only `true` + `ANTHROPIC_API_KEY` turns on the optional AI layer |

## Option A — Docker Compose (recommended)

```bash
cp .env.example .env      # edit the values above
docker compose up --build -d
docker compose exec app npx prisma db seed   # first run only: create admin + demo data
```

The app is on `http://localhost:3000`. SQLite is persisted to the named volume
`dcm-data`, so your data survives restarts and rebuilds. Put it behind a reverse proxy
(Caddy/nginx/Traefik) with TLS for anything beyond localhost.

The container command runs `prisma migrate deploy` on start, so schema upgrades apply
automatically when you pull a new image.

## Option B — Postgres for a larger society

1. In `prisma/schema.prisma` set `datasource db { provider = "postgresql" }`.
2. Point `DATABASE_URL` at your Postgres instance (the commented `db` service in
   `docker-compose.yml` is a starting point).
3. `npx prisma migrate deploy && npx prisma db seed`.

Postgres is worth it once you have many members/records or want concurrent writes;
SQLite is perfectly fine for a single coordinator or a personal fork.

## Loading real taxonomy

The seed ships only a tiny demo slice. To populate the real family, import a sanctioned
export (WCVP CSV, Darwin-Core, …) — see [`IMPORT.md`](IMPORT.md):

```bash
docker compose exec app npm run import-taxa -- --file /data/wcvp.csv --ref-db "Kew POWO / WCVP"
```

## Upgrades & backups

- **Backup:** `npm run export` writes a full JSON snapshot (or copy the SQLite file /
  `pg_dump`). Restore with `npm run import -- <file>` into an empty database.
- **Upgrade:** pull the new image and `docker compose up -d --build`; migrations run on
  boot. Take a backup first.

## Network policy note (Claude Code on the web)

If you run this project inside a Claude Code remote environment, outbound access is
governed by the environment's network policy. The app itself makes **no outbound calls
with AI disabled**. With AI enabled it calls only `api.anthropic.com`, so an
allowlist-style policy needs that host. See
https://code.claude.com/docs/en/claude-code-on-the-web.
