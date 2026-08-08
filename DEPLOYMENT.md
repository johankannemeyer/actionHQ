# ActionHQ SQLite/D1 deployment package

This package contains the restored ActionHQ portal from before the Neon
Postgres migration.

## Included

- Complete application source
- Cloudflare D1/SQLite schema and Drizzle migrations
- `package.json` and locked dependency versions
- A backup of the current local database in `database-backup/actionhq.sqlite`
- A portable SQL export in `database-backup/actionhq-data.sql`

The backup contains the Die Bron team, its seasons, players, scorecards and
ball-by-ball data as it existed when this package was created.

## Local check

```bash
npm install
npm run build
npm run dev
```

The local application runs at `http://localhost:3002/`.

## Hosting requirement

This restored version uses a Cloudflare D1 binding named `DB`, declared in
`.openai/hosting.json`. Deploy it to a platform that provides Cloudflare D1 or
an equivalent injected `DB` binding.

The SQLite backup file is not automatically copied into a hosted D1 database.
Create the hosted D1 database, apply the SQL migrations in `drizzle/`, and then
import `database-backup/actionhq-data.sql` when the hosted database is empty.

Do not import the SQL export into a database that already contains ActionHQ
records, because that can create duplicate primary keys and statistics.

## Important Vercel note

Vercel does not provide a Cloudflare D1 binding. The Neon/Postgres version is
the version intended for Vercel. This restored ZIP is intended for Cloudflare
Workers, OpenAI Sites, or another environment that supports the D1 binding.

## Security

The package excludes Git history, local environment files, Neon credentials,
dependency folders, build caches and hosting-provider metadata.
