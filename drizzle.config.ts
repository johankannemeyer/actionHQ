import { defineConfig } from "drizzle-kit";

const postgresUrl = process.env.POSTGRES_URL?.trim();

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  ...(postgresUrl ? { dbCredentials: { url: postgresUrl } } : {}),
});
