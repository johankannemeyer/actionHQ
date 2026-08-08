# Move ActionHQ from SQLite to Neon Postgres

The browser still uses the existing `/api/*` routes. Those routes now open a
server-only Neon connection through `db/index.ts`; `POSTGRES_URL` is never sent
to the frontend. There is deliberately no route that accepts arbitrary SQL.

## 1. Configure the connection

Create a Neon database and copy its pooled connection string into `.env.local`:

```bash
POSTGRES_URL=postgresql://user:password@ep-example-pooler.region.aws.neon.tech/neondb?sslmode=require
```

Use the same variable as a server-side secret in the hosting environment. Do
not rename it to `NEXT_PUBLIC_POSTGRES_URL`.

## 2. Install and initialize Postgres

```bash
npm install
npm run db:migrate
```

`db/schema.ts` is the source of truth. The generated Postgres migration lives
in `drizzle/`. The former SQLite migration history is preserved in
`drizzle-sqlite/` for reference and is not applied to Neon.

## 3. Copy the current SQLite data once

Locate the actual `.sqlite` file used by the local application and run:

```bash
POSTGRES_URL='your-neon-url' \
SQLITE_PATH='/absolute/path/to/local.sqlite' \
npm run db:migrate:sqlite
```

Add `-- --dry-run` to count compatible source rows without inserting them. The
copy command refuses to run if any application table in Neon already contains
data, preventing an accidental duplicate import. It preserves primary keys and
resets Postgres sequences after the copy.

## 4. Verify

Start the app and open `/api/database`. A healthy response includes:

```json
{
  "status": "connected",
  "provider": "Neon Postgres"
}
```

Then confirm the team, seasons, player profiles, games, full scorecards, and
ball-by-ball data in the normal UI before removing any local SQLite backup.

## Ongoing schema changes

Edit `db/schema.ts`, generate a migration, review it, and apply it:

```bash
npm run db:generate
npm run db:migrate
```
