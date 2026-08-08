import { sql } from "drizzle-orm";
import { getDb } from "../../../db";

export async function GET() {
  try {
    await getDb().execute(sql`select 1 as ok`);
    return Response.json(
      { status: "connected", provider: "Neon Postgres" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable", error: "Could not connect to Postgres." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
