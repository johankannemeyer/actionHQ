// One-shot Neon Postgres setup: creates the schema, then loads the data export.
// Usage:  DATABASE_URL="postgres://..."  node scripts/setup-db.mjs
// Uses the @neondatabase/serverless Pool driver (already a project dependency)
// over Node's built-in WebSocket (Node >= 21). No psql or extra packages needed.

import { readFileSync } from "node:fs";
import { neonConfig, Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Run:\n  export DATABASE_URL="<your Neon pooled connection string>"');
  process.exit(1);
}

if (!globalThis.WebSocket) {
  console.error("This script needs Node 21+ (for a built-in WebSocket). Your Node is too old.");
  process.exit(1);
}
neonConfig.webSocketConstructor = globalThis.WebSocket;

const root = new URL("../", import.meta.url);
const ddl = readFileSync(new URL("drizzle/0000_init_postgres.sql", root), "utf8");
const seed = readFileSync(new URL("database-backup/postgres-seed.sql", root), "utf8");

const pool = new Pool({ connectionString: url });

try {
  console.log("Creating schema...");
  await pool.query(ddl); // multi-statement DDL, run as one batch

  console.log("Loading data (~4,776 rows)...");
  await pool.query(seed); // seed wraps its own BEGIN/COMMIT

  const counts = await pool.query(
    "select (select count(*) from player_profiles) as players, (select count(*) from synced_matches) as matches, (select count(*) from match_deliveries) as deliveries"
  );
  console.log("Done. Loaded:", counts.rows[0]);
} catch (err) {
  console.error("\nSetup failed:\n", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
