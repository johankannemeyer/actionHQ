import { and, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import { getDb } from "../../../db";
import { matchPerformances, performanceClaims, playerProfileLinks, playerProfiles, seasonPlayerStats, syncedMatches, teamSeasons, teams } from "../../../db/schema";

const normalizePlayerName = (value: string) => value
  .replace(/^\s*\d+\s*/, "")
  .replace(/\bunknown\b/gi, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

async function playerBundle(profile: typeof playerProfiles.$inferSelect) {
  const db = getDb();
  const links = await db.select().from(playerProfileLinks).where(eq(playerProfileLinks.ownerProfileId, profile.id));
  const profileIds = [profile.id, ...links.map((link) => link.sourceProfileId)];
  const [seasonHistory, claimedMatches, candidateRows, allLinks] = await Promise.all([
    db.select({
      id: seasonPlayerStats.id,
      teamSeasonId: teamSeasons.id,
      sourceProfileId: seasonPlayerStats.playerProfileId,
      seasonId: teamSeasons.externalSeasonId,
      divisionId: teamSeasons.externalDivisionId,
      teamName: teams.name,
      sourceName: seasonPlayerStats.sourceName,
      active: seasonPlayerStats.active,
      games: seasonPlayerStats.games,
      runs: seasonPlayerStats.runs,
      strikeRate: seasonPlayerStats.strikeRate,
      wickets: seasonPlayerStats.wickets,
      contribution: seasonPlayerStats.contribution,
      contributionAverage: seasonPlayerStats.contributionAverage,
      lastSyncedAt: teamSeasons.lastSyncedAt,
    }).from(seasonPlayerStats)
      .innerJoin(teamSeasons, eq(seasonPlayerStats.teamSeasonId, teamSeasons.id))
      .innerJoin(teams, eq(teamSeasons.teamId, teams.id))
      .where(inArray(seasonPlayerStats.playerProfileId, profileIds))
      .orderBy(desc(teamSeasons.lastSyncedAt)),
    db.select({
      claimId: performanceClaims.id,
      sourceProfileId: performanceClaims.playerProfileId,
      teamSeasonId: syncedMatches.teamSeasonId,
      fixtureId: syncedMatches.fixtureId,
      playedAt: syncedMatches.playedAt,
      homeTeam: syncedMatches.homeTeam,
      awayTeam: syncedMatches.awayTeam,
      homeScore: syncedMatches.homeScore,
      awayScore: syncedMatches.awayScore,
      scoresheetUrl: syncedMatches.scoresheetUrl,
      teamName: matchPerformances.teamName,
      playerName: matchPerformances.playerName,
      runs: matchPerformances.runs,
      strikeRate: matchPerformances.strikeRate,
      oversBowled: matchPerformances.oversBowled,
      runsConceded: matchPerformances.runsConceded,
      wickets: matchPerformances.wickets,
      economy: matchPerformances.economy,
      contribution: matchPerformances.contribution,
    }).from(performanceClaims)
      .innerJoin(matchPerformances, eq(performanceClaims.matchPerformanceId, matchPerformances.id))
      .innerJoin(syncedMatches, eq(matchPerformances.syncedMatchId, syncedMatches.id))
      .where(and(
        inArray(performanceClaims.playerProfileId, profileIds),
        isNull(syncedMatches.removedAt),
      ))
      .orderBy(desc(performanceClaims.id)),
    db.select({
      sourceProfileId: playerProfiles.id,
      sourceName: seasonPlayerStats.sourceName,
      teamName: teams.name,
      seasonId: teamSeasons.externalSeasonId,
      divisionId: teamSeasons.externalDivisionId,
      games: seasonPlayerStats.games,
      runs: seasonPlayerStats.runs,
      wickets: seasonPlayerStats.wickets,
    }).from(playerProfiles)
      .innerJoin(seasonPlayerStats, eq(seasonPlayerStats.playerProfileId, playerProfiles.id))
      .innerJoin(teamSeasons, eq(seasonPlayerStats.teamSeasonId, teamSeasons.id))
      .innerJoin(teams, eq(teamSeasons.teamId, teams.id))
      .where(and(eq(playerProfiles.normalizedName, profile.normalizedName), isNull(playerProfiles.registeredAt), ne(playerProfiles.id, profile.id)))
      .orderBy(desc(teamSeasons.lastSyncedAt)),
    db.select().from(playerProfileLinks),
  ]);

  const linkedSourceIds = new Set(allLinks.map((link) => link.sourceProfileId));
  const candidates = new Map<number, {
    sourceProfileId: number;
    sourceName: string;
    teams: Array<{ teamName: string; seasonId: string; divisionId: string; games: number; runs: number; wickets: number }>;
  }>();
  for (const row of candidateRows) {
    if (linkedSourceIds.has(row.sourceProfileId)) continue;
    const candidate = candidates.get(row.sourceProfileId) ?? { sourceProfileId: row.sourceProfileId, sourceName: row.sourceName, teams: [] };
    candidate.teams.push({ teamName: row.teamName, seasonId: row.seasonId, divisionId: row.divisionId, games: row.games, runs: row.runs, wickets: row.wickets });
    candidates.set(row.sourceProfileId, candidate);
  }

  const seasonById = new Map(seasonHistory.map((season) => [season.teamSeasonId, season]));
  const scorecardsBySeason = new Map<number, { games: number; runs: number; strikeRate: number; oversBowled: number; runsConceded: number; wickets: number; economy: number; contribution: number }>();
  for (const match of claimedMatches) {
    const playerSeason = match.teamSeasonId ? seasonById.get(match.teamSeasonId) : null;
    if (!playerSeason || playerSeason.teamName.toLowerCase() !== match.teamName.toLowerCase()) continue;
    const totals = scorecardsBySeason.get(playerSeason.teamSeasonId) ?? { games: 0, runs: 0, strikeRate: 0, oversBowled: 0, runsConceded: 0, wickets: 0, economy: 0, contribution: 0 };
    totals.games += 1; totals.runs += match.runs; totals.strikeRate += match.strikeRate; totals.oversBowled += match.oversBowled; totals.runsConceded += match.runsConceded; totals.wickets += match.wickets; totals.economy += match.economy; totals.contribution += match.contribution;
    scorecardsBySeason.set(playerSeason.teamSeasonId, totals);
  }
  const scoredSeasonHistory = seasonHistory.map((season) => {
    const totals = scorecardsBySeason.get(season.teamSeasonId) ?? { games: 0, runs: 0, strikeRate: 0, oversBowled: 0, runsConceded: 0, wickets: 0, economy: 0, contribution: 0 };
    const average = (total: number, divisor: number) => divisor ? Math.round(total / divisor * 10) / 10 : 0;
    return { ...season, games: totals.games, runs: totals.runs, strikeRate: average(totals.strikeRate, totals.games), wickets: totals.wickets, contribution: totals.contribution, contributionAverage: average(totals.contribution, totals.games) };
  });
  const seasonTotals = scoredSeasonHistory.reduce((totals, season) => ({
    games: totals.games + season.games,
    runs: totals.runs + season.runs,
    wickets: totals.wickets + season.wickets,
    contribution: totals.contribution + season.contribution,
  }), { games: 0, runs: 0, wickets: 0, contribution: 0 });
  const fillerMatches = claimedMatches.filter((match) => {
    const playerSeason = match.teamSeasonId ? seasonById.get(match.teamSeasonId) : null;
    return !playerSeason || playerSeason.teamName.toLowerCase() !== match.teamName.toLowerCase();
  });
  const fillerTotals = fillerMatches.reduce((totals, match) => ({
    games: totals.games + 1,
    runs: totals.runs + match.runs,
    wickets: totals.wickets + match.wickets,
    contribution: totals.contribution + match.contribution,
  }), { games: 0, runs: 0, wickets: 0, contribution: 0 });
  const strikeRateSamples = claimedMatches.map((match) => match.strikeRate).filter((rate) => rate > 0);
  const seasonCount = new Set(scoredSeasonHistory.map((season) => `${season.teamName}:${season.seasonId}:${season.divisionId}`)).size;

  return {
    ...profile,
    allTime: {
      games: seasonTotals.games + fillerTotals.games,
      runs: seasonTotals.runs + fillerTotals.runs,
      wickets: seasonTotals.wickets + fillerTotals.wickets,
      contribution: seasonTotals.contribution + fillerTotals.contribution,
      strikeRate: strikeRateSamples.length ? Math.round(strikeRateSamples.reduce((sum, rate) => sum + rate, 0) / strikeRateSamples.length * 10) / 10 : 0,
      seasons: seasonCount,
      linkedMatches: claimedMatches.length,
      fillerMatches: fillerMatches.length,
    },
    linkedSourceIds: links.map((link) => link.sourceProfileId),
    linkCandidates: [...candidates.values()],
    seasons: scoredSeasonHistory,
    matches: claimedMatches,
  };
}

export async function GET() {
  try {
    const db = getDb();
    const [profiles, directoryProfiles, identityLinks] = await Promise.all([
      db.select().from(playerProfiles).where(isNotNull(playerProfiles.registeredAt)).orderBy(desc(playerProfiles.createdAt)),
      db.select().from(playerProfiles).orderBy(desc(playerProfiles.createdAt)),
      db.select({ sourceProfileId: playerProfileLinks.sourceProfileId }).from(playerProfileLinks),
    ]);
    const linkedSourceIds = new Set(identityLinks.map((link) => link.sourceProfileId));
    const visibleDirectoryProfiles = directoryProfiles.filter((profile) => !linkedSourceIds.has(profile.id));
    const [players, directory] = await Promise.all([
      Promise.all(profiles.map(playerBundle)),
      Promise.all(visibleDirectoryProfiles.map(async (profile) => {
        const bundled = await playerBundle(profile);
        return { ...bundled, email: null, phone: null };
      })),
    ]);
    return Response.json({ players, directory });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load player profiles." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { sourcePlayerId?: number; email?: string };
    const sourcePlayerId = Number(body.sourcePlayerId);
    const email = String(body.email ?? "").trim().toLowerCase() || null;
    if (!sourcePlayerId) return Response.json({ error: "Choose a player imported by a team sync." }, { status: 400 });

    const db = getDb();
    const [source] = await db.select({ profile: playerProfiles })
      .from(playerProfiles)
      .innerJoin(seasonPlayerStats, eq(seasonPlayerStats.playerProfileId, playerProfiles.id))
      .where(eq(playerProfiles.id, sourcePlayerId))
      .limit(1);
    if (!source) return Response.json({ error: "That player is not part of a synced team roster." }, { status: 404 });
    if (source.profile.registeredAt) return Response.json({ error: "That synced player has already been claimed." }, { status: 409 });
    const [linked] = await db.select().from(playerProfileLinks).where(eq(playerProfileLinks.sourceProfileId, sourcePlayerId)).limit(1);
    if (linked) return Response.json({ error: "That synced player is already linked to another profile." }, { status: 409 });
    if (email) {
      const [emailOwner] = await db.select().from(playerProfiles).where(eq(playerProfiles.email, email)).limit(1);
      if (emailOwner && emailOwner.id !== sourcePlayerId) return Response.json({ error: "That email is already connected to another player profile." }, { status: 409 });
    }
    const [profile] = await db.update(playerProfiles).set({ email, registeredAt: new Date().toISOString() }).where(eq(playerProfiles.id, sourcePlayerId)).returning();
    return Response.json({ player: await playerBundle(profile) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not register this player." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { action?: string; playerId?: number; displayName?: string; email?: string; phone?: string; bio?: string; role?: string; preferredVenue?: string; imageUrl?: string | null; ownerPlayerId?: number; sourcePlayerId?: number };
    const db = getDb();
    if (body.action === "setPlayerImage") {
      const playerId = Number(body.playerId);
      if (!playerId) return Response.json({ error: "Player is required." }, { status: 400 });
      const img = body.imageUrl;
      let imageUrl: string | null;
      if (img === null || img === undefined || img === "") imageUrl = null;
      else if (typeof img === "string" && img.startsWith("data:image/") && img.length <= 1_500_000) imageUrl = img;
      else return Response.json({ error: "Image must be a valid image file under about 1MB." }, { status: 400 });
      const [imaged] = await db.update(playerProfiles).set({ imageUrl }).where(eq(playerProfiles.id, playerId)).returning();
      if (!imaged) return Response.json({ error: "Player profile not found." }, { status: 404 });
      return Response.json({ player: await playerBundle(imaged) });
    }
    if (body.action === "update") {
      const playerId = Number(body.playerId);
      const displayName = String(body.displayName ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase() || null;
      const phone = String(body.phone ?? "").trim() || null;
      const bio = String(body.bio ?? "").trim().slice(0, 280);
      const role = String(body.role ?? "All-rounder");
      const preferredVenue = String(body.preferredVenue ?? "").trim().slice(0, 120);
      if (!playerId || !displayName) return Response.json({ error: "Player name is required." }, { status: 400 });
      if (!["All-rounder", "Batter", "Bowler", "Wicketkeeper"].includes(role)) return Response.json({ error: "Choose a valid playing role." }, { status: 400 });
      const normalizedName = normalizePlayerName(displayName);
      const updateValues: Partial<typeof playerProfiles.$inferInsert> = { displayName, normalizedName, email, phone, bio, role, preferredVenue };
      if (body.imageUrl !== undefined) {
        const img = body.imageUrl;
        if (img === null || img === "") updateValues.imageUrl = null;
        else if (typeof img === "string" && img.startsWith("data:image/") && img.length <= 1_500_000) updateValues.imageUrl = img;
        else return Response.json({ error: "Image must be a valid image file under about 1MB." }, { status: 400 });
      }
      const [profile] = await db.update(playerProfiles).set(updateValues).where(eq(playerProfiles.id, playerId)).returning();
      if (!profile) return Response.json({ error: "Player profile not found." }, { status: 404 });
      return Response.json({ player: await playerBundle(profile) });
    }
    const ownerPlayerId = Number(body.ownerPlayerId);
    const sourcePlayerId = Number(body.sourcePlayerId);
    if (!ownerPlayerId || !sourcePlayerId || ownerPlayerId === sourcePlayerId) return Response.json({ error: "Choose a valid team player to link." }, { status: 400 });

    const [[owner], [source]] = await Promise.all([
      db.select().from(playerProfiles).where(eq(playerProfiles.id, ownerPlayerId)).limit(1),
      db.select().from(playerProfiles).where(eq(playerProfiles.id, sourcePlayerId)).limit(1),
    ]);
    if (!owner?.registeredAt) return Response.json({ error: "Register the player profile before linking team history." }, { status: 400 });
    if (!source || source.registeredAt) return Response.json({ error: "That team player is already registered." }, { status: 409 });
    if (owner.normalizedName !== source.normalizedName) return Response.json({ error: "The registered name and team player name do not match safely." }, { status: 409 });

    const [existing] = await db.select().from(playerProfileLinks).where(eq(playerProfileLinks.sourceProfileId, source.id)).limit(1);
    if (existing && existing.ownerProfileId !== owner.id) return Response.json({ error: "That team player is already linked to another account." }, { status: 409 });
    if (!existing) await db.insert(playerProfileLinks).values({ ownerProfileId: owner.id, sourceProfileId: source.id });
    return Response.json({ player: await playerBundle(owner) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not link this team player." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { playerId?: number; fixtureId?: string; sourceName?: string };
    const playerId = Number(body.playerId);
    const fixtureId = String(body.fixtureId ?? "").trim();
    if (!playerId || !fixtureId) return Response.json({ error: "Player and Fixture ID are required." }, { status: 400 });

    const db = getDb();
    const [[profile], [match]] = await Promise.all([
      db.select().from(playerProfiles).where(eq(playerProfiles.id, playerId)).limit(1),
      db.select().from(syncedMatches).where(and(eq(syncedMatches.fixtureId, fixtureId), isNull(syncedMatches.removedAt))).limit(1),
    ]);
    if (!profile?.registeredAt) return Response.json({ error: "Register your player profile first." }, { status: 404 });
    if (!match) return Response.json({ error: "Upload this fixture's completed HTML scorecard before linking the appearance." }, { status: 404 });

    const performances = await db.select().from(matchPerformances).where(eq(matchPerformances.syncedMatchId, match.id));
    const targetName = normalizePlayerName(String(body.sourceName ?? profile.displayName));
    const matching = performances.filter((performance) => normalizePlayerName(performance.playerName) === targetName);
    if (matching.length !== 1) {
      return Response.json({
        error: matching.length ? "More than one scorecard row matches your name. Choose your scorecard name." : `No scorecard row matched ${profile.displayName}. Choose your scorecard name once to link it.`,
        candidates: performances.map((performance) => ({ name: performance.playerName, teamName: performance.teamName })),
      }, { status: 409 });
    }

    const performance = matching[0];
    const [claimed] = await db.select().from(performanceClaims).where(eq(performanceClaims.matchPerformanceId, performance.id)).limit(1);
    if (claimed && claimed.playerProfileId !== profile.id) {
      const [alias] = await db.select().from(playerProfileLinks).where(and(eq(playerProfileLinks.ownerProfileId, profile.id), eq(playerProfileLinks.sourceProfileId, claimed.playerProfileId))).limit(1);
      if (!alias) return Response.json({ error: "That scorecard appearance is already linked to another player." }, { status: 409 });
    }
    if (!claimed) await db.insert(performanceClaims).values({ playerProfileId: profile.id, matchPerformanceId: performance.id });
    return Response.json({ player: await playerBundle(profile) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not add this match." }, { status: 500 });
  }
}
