# Deploying ActionHQ to Vercel (Next.js + Neon Postgres)

This app was converted from the Cloudflare D1 / vinext build to **standard Next.js
with a Neon serverless Postgres database**, so it runs natively on Vercel.

## 1. Create a Postgres database

Use Neon (recommended, works with the `@neondatabase/serverless` driver):

- Create a project at https://neon.tech (or add a Postgres store from the Vercel
  dashboard: Storage -> Create -> Neon).
- Copy the **pooled** connection string. It looks like:
  `postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/DB?sslmode=require`

## 2. Set the environment variable

Local development — create a `.env` file in the project root:

```
DATABASE_URL="postgresql://...your Neon pooled connection string..."
```

On Vercel — Project -> Settings -> Environment Variables -> add `DATABASE_URL`
for Production (and Preview/Development if you want).

## 3. Create the tables

From the project root, with `DATABASE_URL` set:

```bash
npm install
npm run db:migrate      # applies drizzle/0000_init_postgres.sql
```

(`npm run db:push` also works if you prefer pushing the schema directly.)

## 4. Import your existing data (one time)

The full export of your current data is in
`database-backup/postgres-seed.sql` (Die Bron team, player profiles,
scorecards and ball-by-ball data — ~4,776 rows). Load it into the empty
database **after** step 3:

```bash
psql "$DATABASE_URL" -f database-backup/postgres-seed.sql
```

Only run this once, into a fresh database. Re-running will create duplicate
key errors.

## 5. Deploy

Push to GitHub and import the repo in Vercel (Framework preset: **Next.js**),
or run `vercel --prod`. Make sure `DATABASE_URL` is set in the Vercel project
before the build.

## Notes

- The old ChatGPT/OpenAI auth relied on the `oai-authenticated-user-email`
  header injected by the OpenAI hosting platform. On Vercel that header is not
  present, so `getChatGPTUser()` returns `null`. Add your own auth if you need
  gated access.
- `database-backup/` is git-ignored so your data is not pushed to GitHub.
