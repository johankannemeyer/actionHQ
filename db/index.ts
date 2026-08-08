import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let dbInstance: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (dbInstance) return dbInstance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is unavailable. Set it to your Neon (or other Postgres) connection string in the environment (e.g. Vercel project settings or a local .env file)."
    );
  }

  dbInstance = drizzle(neon(url), { schema });
  return dbInstance;
}
