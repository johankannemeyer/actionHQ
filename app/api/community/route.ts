import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { challengeEntries, playerFollows, playerProfileLinks, playerProfiles, seasonPlayerStats, teamInvitations, teamSeasons, teams } from "../../../db/schema";

const normalizeName = (value: string) => value
  .replace(/^\s*\d+\s*/, "")
  .replace(/\bunknown\b/gi, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

export async function GET() {
  try {
    const db = getDb();
    const [invitations, challenges, follows] = await Promise.all([
      db.select({
        id: teamInvitations.id,
        teamId: teamInvitations.teamId,
        teamName: teams.name,
        playerName: teamInvitations.playerName,
        email: teamInvitations.email,
        token: teamInvitations.token,
        status: teamInvitations.status,
        claimedProfileId: teamInvitations.claimedProfileId,
        createdAt: teamInvitations.createdAt,
      }).from(teamInvitations).innerJoin(teams, eq(teamInvitations.teamId, teams.id)).orderBy(desc(teamInvitations.id)),
      db.select().from(challengeEntries).orderBy(desc(challengeEntries.id)),
      db.select().from(playerFollows).orderBy(desc(playerFollows.id)),
    ]);
    return Response.json({ invitations, challenges, follows });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load community activity." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    const db = getDb();

    if (action === "invite") {
      const teamId = Number(body.teamId);
      const playerName = String(body.playerName ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase() || null;
      if (!teamId || !playerName) return Response.json({ error: "Team and player name are required." }, { status: 400 });
      const [rosterPlayer] = await db.select({ sourceName: seasonPlayerStats.sourceName })
        .from(seasonPlayerStats)
        .innerJoin(playerProfiles, eq(seasonPlayerStats.playerProfileId, playerProfiles.id))
        .innerJoin(teamSeasons, eq(seasonPlayerStats.teamSeasonId, teamSeasons.id))
        .where(and(eq(teamSeasons.teamId, teamId), eq(playerProfiles.normalizedName, normalizeName(playerName))))
        .limit(1);
      if (!rosterPlayer) return Response.json({ error: "Choose a player imported from this team's synced roster." }, { status: 404 });
      const [invitation] = await db.insert(teamInvitations).values({ teamId, playerName: rosterPlayer.sourceName, email, token: crypto.randomUUID() }).returning();
      const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      return Response.json({ invitation: { ...invitation, teamName: team?.name ?? "Team" } }, { status: 201 });
    }

    if (action === "challenge") {
      const playerProfileId = Number(body.playerId);
      const challengeKey = String(body.challengeKey ?? "wicket-hunter").trim();
      if (!playerProfileId) return Response.json({ error: "Register a player profile to join." }, { status: 400 });
      const [existing] = await db.select().from(challengeEntries).where(and(eq(challengeEntries.playerProfileId, playerProfileId), eq(challengeEntries.challengeKey, challengeKey))).limit(1);
      if (existing) {
        await db.delete(challengeEntries).where(eq(challengeEntries.id, existing.id));
        return Response.json({ joined: false, id: existing.id });
      }
      const [entry] = await db.insert(challengeEntries).values({ playerProfileId, challengeKey }).returning();
      return Response.json({ joined: true, entry }, { status: 201 });
    }

    if (action === "follow") {
      const followerProfileId = Number(body.followerId);
      const followingProfileId = Number(body.followingId);
      if (!followerProfileId || !followingProfileId || followerProfileId === followingProfileId) return Response.json({ error: "Choose another player to follow." }, { status: 400 });
      const [existing] = await db.select().from(playerFollows).where(and(eq(playerFollows.followerProfileId, followerProfileId), eq(playerFollows.followingProfileId, followingProfileId))).limit(1);
      if (existing) {
        await db.delete(playerFollows).where(eq(playerFollows.id, existing.id));
        return Response.json({ following: false, id: existing.id });
      }
      const [follow] = await db.insert(playerFollows).values({ followerProfileId, followingProfileId }).returning();
      return Response.json({ following: true, follow }, { status: 201 });
    }

    return Response.json({ error: "Unknown community action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save that action." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { token?: string; playerId?: number };
    const token = String(body.token ?? "").trim();
    const playerId = Number(body.playerId);
    if (!token || !playerId) return Response.json({ error: "Invitation and player profile are required." }, { status: 400 });
    const db = getDb();
    const [[invitation], [profile]] = await Promise.all([
      db.select().from(teamInvitations).where(eq(teamInvitations.token, token)).limit(1),
      db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId)).limit(1),
    ]);
    if (!invitation || invitation.status === "revoked") return Response.json({ error: "This invitation is no longer available." }, { status: 404 });
    if (!profile?.registeredAt) return Response.json({ error: "Register your player profile first." }, { status: 400 });
    if (normalizeName(invitation.playerName) !== profile.normalizedName) return Response.json({ error: `This invitation is for ${invitation.playerName}. Select or register that player profile.` }, { status: 409 });
    const sourceProfiles = await db.select({ profile: playerProfiles }).from(playerProfiles)
      .innerJoin(seasonPlayerStats, eq(seasonPlayerStats.playerProfileId, playerProfiles.id))
      .innerJoin(teamSeasons, eq(seasonPlayerStats.teamSeasonId, teamSeasons.id))
      .where(and(eq(teamSeasons.teamId, invitation.teamId), eq(playerProfiles.normalizedName, profile.normalizedName)));
    const uniqueSources = [...new Map(sourceProfiles.map((row) => [row.profile.id, row.profile])).values()];
    if (uniqueSources.length === 1 && uniqueSources[0].id !== profile.id && !uniqueSources[0].registeredAt) {
      const [savedLink] = await db.select().from(playerProfileLinks).where(eq(playerProfileLinks.sourceProfileId, uniqueSources[0].id)).limit(1);
      if (!savedLink) await db.insert(playerProfileLinks).values({ ownerProfileId: profile.id, sourceProfileId: uniqueSources[0].id });
    }
    const [updated] = await db.update(teamInvitations).set({ status: "accepted", claimedProfileId: profile.id }).where(eq(teamInvitations.id, invitation.id)).returning();
    return Response.json({ invitation: updated });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not accept this invitation." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = Number((await request.json() as { id?: number }).id);
    if (!id) return Response.json({ error: "Invitation id is required." }, { status: 400 });
    const [invitation] = await getDb().update(teamInvitations).set({ status: "revoked" }).where(eq(teamInvitations.id, id)).returning();
    return Response.json({ invitation });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not revoke that invitation." }, { status: 500 });
  }
}
