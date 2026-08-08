import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Database = NeonHttpDatabase<typeof schema>;

let database: Database | null = null;

function postgresUrl() {
  const value = process.env.POSTGRES_URL?.trim();
  if (!value) {
    throw new Error(
      "POSTGRES_URL is missing. Add the pooled Neon connection string to the server environment before using the API."
    );
  }
  return value;
}

export function getDb() {
  if (!database) {
    const client = neon(postgresUrl());
    database = drizzle({ client, schema });
  }
  return database;
}
