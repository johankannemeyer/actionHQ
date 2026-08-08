import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { fixtures, teamSeasons } from "../../../db/schema";

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "Fixture storage is being prepared. Please try again shortly.";
  }
  return message;
}

export async function GET() {
  try {
    const rows = await getDb().select().from(fixtures).orderBy(desc(fixtures.id));
    return Response.json({ fixtures: rows });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.type === "manual") {
      const teamName = String(body.teamName ?? "").trim();
      const teamSeasonId = Number(body.teamSeasonId);
      const opponent = String(body.opponent ?? "").trim();
      const fixtureDate = String(body.fixtureDate ?? "").trim();
      const venue = String(body.venue ?? "Action Sports South Africa").trim();
      if (!teamName || !teamSeasonId || !opponent || !fixtureDate) return Response.json({ error: "Current season, opponent and date are required." }, { status: 400 });
      const db = getDb();
      const [season] = await db.select().from(teamSeasons).where(eq(teamSeasons.id, teamSeasonId)).limit(1);
      if (!season) return Response.json({ error: "Choose a valid team season first." }, { status: 404 });
      const [fixture] = await db.insert(fixtures).values({ teamSeasonId, scoresheetUrl: "manual", teamName, opponent, fixtureDate, venue }).returning();
      return Response.json({ fixture }, { status: 201 });
    }
    return Response.json({ error: "Fixtures are added manually. Completed games must be uploaded as HTML scorecards." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as { id?: number };
    const id = Number(body.id);
    if (!id) return Response.json({ error: "Fixture id is required." }, { status: 400 });
    const [fixture] = await getDb().select().from(fixtures).where(eq(fixtures.id, id)).limit(1);
    if (!fixture) return Response.json({ error: "That fixture could not be found." }, { status: 404 });
    await getDb().delete(fixtures).where(eq(fixtures.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
