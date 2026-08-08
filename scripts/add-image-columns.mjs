// Adds the image_url columns to an existing Neon database (idempotent).
// Usage:  DATABASE_URL="postgres://..."  node scripts/add-image-columns.mjs
import { neonConfig, Pool } from "@neondatabase/serverless";
const url = process.env.DATABASE_URL;
if (!url) { console.error('Set DATABASE_URL first.'); process.exit(1); }
if (!globalThis.WebSocket) { console.error("Needs Node 21+."); process.exit(1); }
neonConfig.webSocketConstructor = globalThis.WebSocket;
const pool = new Pool({ connectionString: url });
try {
  await pool.query('ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "image_url" text;');
  await pool.query('ALTER TABLE "player_profiles" ADD COLUMN IF NOT EXISTS "image_url" text;');
  console.log("Done. image_url columns are present on teams and player_profiles.");
} catch (err) { console.error(err); process.exitCode = 1; } finally { await pool.end(); }
