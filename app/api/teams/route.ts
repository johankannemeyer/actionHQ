import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { fixtures, matchDeliveries, matchInnings, matchOvers, matchPairs, matchPerformances, performanceClaims, playerProfileLinks, playerProfiles, players, seasonPlayerStats, syncedMatches, teamSeasons, teams } from "../../../db/schema";
import { linkTeamPerformancesToRoster, reconcileTeamPlayerProfiles } from "../../../lib/profile-linking";

type PlayerInput = Omit<typeof players.$inferInsert, "id" | "teamId">;

const normalizePlayerName = (value: string) => value
  .replace(/^\s*\d+\s*/, "")
  .replace(/\bunknown\b/gi, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

const isDismissalOutcome = (outcome: string) => ["C", "B", "R", "S", "ST", "M", "HW", "LBW", "I", "OBS", "I/OBS"]
  .includes(outcome.trim().replace(/\s+/g, "").toUpperCase());

function parseTeamProfile(content: string, sourceUrl: string) {
  const url = new URL(sourceUrl);
  const getId = (name: string) => url.searchParams.get(name) ?? "";
  const required = ["VenueId", "LeagueId", "SeasonId", "DivisionId", "TeamId"];
  if (required.some((name) => !getId(name))) throw new Error("The team link must include VenueId, LeagueId, SeasonId, DivisionId and TeamId.");

  const name = (content.match(/^Title:\s*(.*?)\s+Team Profile/im)?.[1] ?? "Action Cricket Team").trim();

  const statsTable = content.match(/Player G R RA SR TO OB W WA RC RCA C CA([\s\S]*?)\*\*G\*\*/i)?.[1] ?? "";
  const parsedPlayers: PlayerInput[] = [];
  for (const rawLine of statsTable.split("\n")) {
    const line = rawLine.trim();
    const values = [...line.matchAll(/-?\d+(?:\.\d+)?/g)];
    if (values.length < 13) continue;
    const stats = values.slice(-12);
    const playerName = line.slice(0, stats[0].index).trim();
    parsedPlayers.push({ name: playerName, games: 0, runs: 0, runsAverage: 0, strikeRate: 0, timesOut: 0, oversBowled: 0, wickets: 0, wicketAverage: 0, runsConceded: 0, runsConcededAverage: 0, contribution: 0, contributionAverage: 0 });
  }

  const now = new Date().toISOString();
  return {
    team: { sourceUrl, externalTeamId: getId("TeamId"), venueId: getId("VenueId"), leagueId: getId("LeagueId"), seasonId: getId("SeasonId"), divisionId: getId("DivisionId"), name, position: null, wins: 0, losses: 0, draws: 0, averageScored: 0, averageConceded: 0, lastSyncedAt: now },
    season: { sourceUrl, name: `Season ${getId("SeasonId")}`, leagueName: `League ${getId("LeagueId")}`, externalSeasonId: getId("SeasonId"), externalLeagueId: getId("LeagueId"), externalDivisionId: getId("DivisionId"), position: null, wins: 0, losses: 0, draws: 0, averageScored: 0, averageConceded: 0, lastSyncedAt: now },
    players: parsedPlayers,
  };
}

async function seasonBundle(season: typeof teamSeasons.$inferSelect) {
  const db = getDb();
  const seasonPlayers = await db.select({
      id: seasonPlayerStats.id,
      playerProfileId: seasonPlayerStats.playerProfileId,
      name: seasonPlayerStats.sourceName,
      active: seasonPlayerStats.active,
      registeredAt: playerProfiles.registeredAt,
      linkedOwnerId: playerProfileLinks.ownerProfileId,
      games: seasonPlayerStats.games,
      runs: seasonPlayerStats.runs,
      runsAverage: seasonPlayerStats.runsAverage,
      strikeRate: seasonPlayerStats.strikeRate,
      timesOut: seasonPlayerStats.timesOut,
      oversBowled: seasonPlayerStats.oversBowled,
      wickets: seasonPlayerStats.wickets,
      wicketAverage: seasonPlayerStats.wicketAverage,
      runsConceded: seasonPlayerStats.runsConceded,
      runsConcededAverage: seasonPlayerStats.runsConcededAverage,
      contribution: seasonPlayerStats.contribution,
      contributionAverage: seasonPlayerStats.contributionAverage,
    }).from(seasonPlayerStats)
      .innerJoin(playerProfiles, eq(seasonPlayerStats.playerProfileId, playerProfiles.id))
      .leftJoin(playerProfileLinks, eq(playerProfileLinks.sourceProfileId, playerProfiles.id))
      .where(eq(seasonPlayerStats.teamSeasonId, season.id))
      .orderBy(asc(seasonPlayerStats.sourceName));
  const canonicalByProfile = new Map<number, number>();
  for (const player of seasonPlayers) {
    const canonicalId = player.linkedOwnerId ?? player.playerProfileId;
    canonicalByProfile.set(player.playerProfileId, canonicalId);
    canonicalByProfile.set(canonicalId, canonicalId);
  }
  const scorecardRows = canonicalByProfile.size ? await db.select({
    playerProfileId: performanceClaims.playerProfileId,
    syncedMatchId: matchPerformances.syncedMatchId,
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
      eq(syncedMatches.teamSeasonId, season.id),
      isNull(syncedMatches.removedAt),
      inArray(performanceClaims.playerProfileId, [...canonicalByProfile.keys()]),
    )) : [];
  const dismissalRows = await db.select({
    syncedMatchId: matchInnings.syncedMatchId,
    batterName: matchDeliveries.batterName,
    outcome: matchDeliveries.outcome,
  }).from(matchDeliveries)
    .innerJoin(matchOvers, eq(matchDeliveries.matchOverId, matchOvers.id))
    .innerJoin(matchPairs, eq(matchOvers.matchPairId, matchPairs.id))
    .innerJoin(matchInnings, eq(matchPairs.matchInningsId, matchInnings.id))
    .innerJoin(syncedMatches, eq(matchInnings.syncedMatchId, syncedMatches.id))
    .where(and(eq(syncedMatches.teamSeasonId, season.id), isNull(syncedMatches.removedAt)));
  const profileByAppearance = new Map<string, number>();
  for (const row of scorecardRows) {
    const canonicalId = canonicalByProfile.get(row.playerProfileId) ?? row.playerProfileId;
    profileByAppearance.set(`${row.syncedMatchId}:${normalizePlayerName(row.playerName)}`, canonicalId);
  }
  const timesOutByProfile = new Map<number, number>();
  for (const delivery of dismissalRows) {
    if (!isDismissalOutcome(delivery.outcome)) continue;
    const profileId = profileByAppearance.get(`${delivery.syncedMatchId}:${normalizePlayerName(delivery.batterName)}`);
    if (profileId) timesOutByProfile.set(profileId, (timesOutByProfile.get(profileId) ?? 0) + 1);
  }
  const totalsByProfile = new Map<number, { games: number; runs: number; strikeRate: number; oversBowled: number; runsConceded: number; wickets: number; economy: number; contribution: number }>();
  for (const row of scorecardRows) {
    const canonicalId = canonicalByProfile.get(row.playerProfileId) ?? row.playerProfileId;
    const totals = totalsByProfile.get(canonicalId) ?? { games: 0, runs: 0, strikeRate: 0, oversBowled: 0, runsConceded: 0, wickets: 0, economy: 0, contribution: 0 };
    totals.games += 1; totals.runs += row.runs; totals.strikeRate += row.strikeRate; totals.oversBowled += row.oversBowled; totals.runsConceded += row.runsConceded; totals.wickets += row.wickets; totals.economy += row.economy; totals.contribution += row.contribution;
    totalsByProfile.set(canonicalId, totals);
  }
  return { ...season, players: seasonPlayers.map((player) => {
    const canonicalId = player.linkedOwnerId ?? player.playerProfileId;
    const totals = totalsByProfile.get(canonicalId) ?? { games: 0, runs: 0, strikeRate: 0, oversBowled: 0, runsConceded: 0, wickets: 0, economy: 0, contribution: 0 };
    const average = (total: number, divisor: number) => divisor ? Math.round(total / divisor * 10) / 10 : 0;
    return { ...player, games: totals.games, runs: totals.runs, runsAverage: average(totals.runs, totals.games), strikeRate: average(totals.strikeRate, totals.games), timesOut: timesOutByProfile.get(canonicalId) ?? 0, oversBowled: totals.oversBowled, wickets: totals.wickets, wicketAverage: average(totals.wickets, totals.games), runsConceded: totals.runsConceded, runsConcededAverage: average(totals.runsConceded, totals.games), contribution: totals.contribution, contributionAverage: average(totals.contribution, totals.games), linkedAppearances: totals.games };
  }), matches: [] };
}

async function teamBundle(team: typeof teams.$inferSelect) {
  const db = getDb();
  const savedSeasons = await db.select().from(teamSeasons).where(and(eq(teamSeasons.teamId, team.id), isNull(teamSeasons.removedAt))).orderBy(desc(teamSeasons.isCurrent), desc(teamSeasons.lastSyncedAt));
  if (!savedSeasons.length) {
    const legacyPlayers = await db.select().from(players).where(eq(players.teamId, team.id)).orderBy(desc(players.contribution));
    return { ...team, players: legacyPlayers, matches: [], seasons: [] };
  }
  const seasons = await Promise.all(savedSeasons.map(seasonBundle));
  const current = seasons[0];
  return { ...team, position: current.position, wins: current.wins, losses: current.losses, draws: current.draws, averageScored: current.averageScored, averageConceded: current.averageConceded, players: current.players, matches: current.matches, seasons };
}

async function findOrCreatePlayerProfile(teamId: number, teamSeasonId: number, sourceName: string) {
  const db = getDb();
  const normalizedName = normalizePlayerName(sourceName) || sourceName.toLowerCase().trim();
  const [seasonProfile] = await db.select({ profile: playerProfiles })
    .from(playerProfiles)
    .innerJoin(seasonPlayerStats, eq(seasonPlayerStats.playerProfileId, playerProfiles.id))
    .where(and(eq(seasonPlayerStats.teamSeasonId, teamSeasonId), eq(playerProfiles.normalizedName, normalizedName)))
    .limit(1);
  if (seasonProfile) return seasonProfile.profile;
  const [existing] = await db.select({ profile: playerProfiles })
    .from(playerProfiles)
    .innerJoin(seasonPlayerStats, eq(seasonPlayerStats.playerProfileId, playerProfiles.id))
    .innerJoin(teamSeasons, eq(teamSeasons.id, seasonPlayerStats.teamSeasonId))
    .where(and(eq(teamSeasons.teamId, teamId), eq(playerProfiles.normalizedName, normalizedName)))
    .limit(1);
  if (existing) {
    const [link] = await db.select().from(playerProfileLinks).where(eq(playerProfileLinks.sourceProfileId, existing.profile.id)).limit(1);
    if (link) {
      const [owner] = await db.select().from(playerProfiles).where(eq(playerProfiles.id, link.ownerProfileId)).limit(1);
      if (owner) return owner;
    }
    return existing.profile;
  }
  const [created] = await db.insert(playerProfiles).values({ displayName: sourceName, normalizedName }).returning();
  return created;
}

export async function GET() {
  try {
    const savedTeams = await getDb().select().from(teams).orderBy(desc(teams.lastSyncedAt));
    const dieBron = savedTeams.find((team) => normalizePlayerName(team.name) === "die bron") ?? savedTeams[0];
    return Response.json({ teams: dieBron ? [await teamBundle(dieBron)] : [] });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load teams." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; sourceUrl?: string; teamId?: number; seasonName?: string; leagueName?: string; externalSeasonId?: string };
    const sourceUrl = String(body.sourceUrl ?? "").trim();
    const requestedTeamId = Number(body.teamId);
    const seasonName = String(body.seasonName ?? "").trim();
    const leagueName = String(body.leagueName ?? "").trim();
    const enteredSeasonId = String(body.externalSeasonId ?? "").trim();
    if (body.action === "previewTeam" || body.action === "createTeam") {
      return Response.json({ error: "ActionHQ is configured for the existing Die Bron team only." }, { status: 403 });
    }
    if (body.action === "createSeason") {
      if (!requestedTeamId || !seasonName || !leagueName || !enteredSeasonId) return Response.json({ error: "Season name, league and Season ID are required." }, { status: 400 });
      const db = getDb();
      const [team] = await db.select().from(teams).where(eq(teams.id, requestedTeamId)).limit(1);
      if (!team) return Response.json({ error: "That team could not be found." }, { status: 404 });
      if (normalizePlayerName(team.name) !== "die bron") return Response.json({ error: "Only the Die Bron team can be managed in this portal." }, { status: 403 });
      const [savedSeason] = await db.select().from(teamSeasons).where(and(eq(teamSeasons.teamId, team.id), eq(teamSeasons.externalSeasonId, enteredSeasonId))).limit(1);
      await db.update(teamSeasons).set({ isCurrent: false }).where(eq(teamSeasons.teamId, team.id));
      if (savedSeason) {
        await db.update(teamSeasons).set({ name: seasonName, leagueName, externalLeagueId: leagueName, isCurrent: true, removedAt: null, lastSyncedAt: new Date().toISOString() }).where(eq(teamSeasons.id, savedSeason.id));
      } else {
        await db.insert(teamSeasons).values({ teamId: team.id, sourceUrl: "manual", name: seasonName, leagueName, externalSeasonId: enteredSeasonId, externalLeagueId: leagueName, externalDivisionId: `manual-${enteredSeasonId}`, isCurrent: true });
      }
      return Response.json({ team: await teamBundle(team) }, { status: savedSeason ? 200 : 201 });
    }
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" || url.hostname !== "actionsport.spawtz.com" || !url.pathname.toLowerCase().includes("/leagues/teamprofile")) {
      return Response.json({ error: "Paste an Action Sport Team Profile link." }, { status: 400 });
    }

    const readerUrl = `https://r.jina.ai/http://${url.host}${url.pathname}?${url.search.slice(1).replaceAll("&", "%26")}`;
    const response = await fetch(readerUrl, { headers: { "User-Agent": "Action Cricket Team Portal/1.0" } });
    if (!response.ok) throw new Error("Action Sport did not return that team profile.");
    const parsed = parseTeamProfile(await response.text(), sourceUrl);
    if (enteredSeasonId && enteredSeasonId !== parsed.season.externalSeasonId) return Response.json({ error: `The profile belongs to Season ${parsed.season.externalSeasonId}, not ${enteredSeasonId}.` }, { status: 400 });
    parsed.season.name = seasonName || parsed.season.name;
    parsed.season.leagueName = leagueName || parsed.season.leagueName;
    const db = getDb();
    if (!requestedTeamId) return Response.json({ error: "This portal only updates the existing Die Bron team." }, { status: 400 });
    const [existing] = await db.select().from(teams).where(eq(teams.id, requestedTeamId)).limit(1);
    if (!existing) return Response.json({ error: "The Die Bron team record could not be found." }, { status: 404 });
    if (normalizePlayerName(existing.name) !== "die bron") return Response.json({ error: "Only the Die Bron team can be managed in this portal." }, { status: 403 });
    if (existing.externalTeamId && parsed.team.externalTeamId !== existing.externalTeamId) {
      return Response.json({ error: "That profile belongs to a different team. Only Die Bron season rosters can be imported." }, { status: 400 });
    }
    const [team] = await db.update(teams).set(parsed.team).where(eq(teams.id, existing.id)).returning();

    let [savedSeason] = await db.select().from(teamSeasons).where(and(
      eq(teamSeasons.teamId, team.id),
      eq(teamSeasons.externalSeasonId, parsed.season.externalSeasonId),
      eq(teamSeasons.externalDivisionId, parsed.season.externalDivisionId),
    )).limit(1);
    if (!savedSeason) {
      [savedSeason] = await db.select().from(teamSeasons).where(and(
        eq(teamSeasons.teamId, team.id),
        eq(teamSeasons.externalSeasonId, parsed.season.externalSeasonId),
        isNull(teamSeasons.removedAt),
      )).limit(1);
    }
    let season: typeof teamSeasons.$inferSelect;
    await db.update(teamSeasons).set({ isCurrent: false }).where(eq(teamSeasons.teamId, team.id));
    if (savedSeason) [season] = await db.update(teamSeasons).set({ ...parsed.season, isCurrent: true, removedAt: null }).where(eq(teamSeasons.id, savedSeason.id)).returning();
    else [season] = await db.insert(teamSeasons).values({ ...parsed.season, teamId: team.id, isCurrent: true }).returning();

    await db.update(seasonPlayerStats).set({ active: false }).where(eq(seasonPlayerStats.teamSeasonId, season.id));
    for (const sourcePlayer of parsed.players) {
      const profile = await findOrCreatePlayerProfile(team.id, season.id, sourcePlayer.name);
      const stats = { sourceName: sourcePlayer.name, active: true, games: sourcePlayer.games, runs: sourcePlayer.runs, runsAverage: sourcePlayer.runsAverage, strikeRate: sourcePlayer.strikeRate, timesOut: sourcePlayer.timesOut, oversBowled: sourcePlayer.oversBowled, wickets: sourcePlayer.wickets, wicketAverage: sourcePlayer.wicketAverage, runsConceded: sourcePlayer.runsConceded, runsConcededAverage: sourcePlayer.runsConcededAverage, contribution: sourcePlayer.contribution, contributionAverage: sourcePlayer.contributionAverage };
      const [savedStats] = await db.select().from(seasonPlayerStats).where(and(eq(seasonPlayerStats.teamSeasonId, season.id), eq(seasonPlayerStats.playerProfileId, profile.id))).limit(1);
      if (savedStats) await db.update(seasonPlayerStats).set(stats).where(eq(seasonPlayerStats.id, savedStats.id));
      else await db.insert(seasonPlayerStats).values({ ...stats, teamSeasonId: season.id, playerProfileId: profile.id });
    }

    // Team sync imports roster identity only. Every statistic comes from uploaded scorecards.
    await reconcileTeamPlayerProfiles(db, team.id);
    await linkTeamPerformancesToRoster(db, team.id);
    return Response.json({ team: await teamBundle(team) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not sync this team." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { action?: string; teamId?: number; seasonId?: number; seasonPlayerId?: number; active?: boolean; seasonName?: string; leagueName?: string; externalSeasonId?: string; imageUrl?: string | null };
    const teamId = Number(body.teamId);
    if (body.action === "setTeamImage") {
      if (!teamId) return Response.json({ error: "Team is required." }, { status: 400 });
      const db = getDb();
      const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      if (!team) return Response.json({ error: "Team not found." }, { status: 404 });
      if (normalizePlayerName(team.name) !== "die bron") return Response.json({ error: "Only the Die Bron team can be managed in this portal." }, { status: 403 });
      const img = body.imageUrl;
      let imageUrl: string | null;
      if (img === null || img === undefined || img === "") imageUrl = null;
      else if (typeof img === "string" && img.startsWith("data:image/") && img.length <= 1_500_000) imageUrl = img;
      else return Response.json({ error: "Image must be a valid image file under about 1MB." }, { status: 400 });
      await db.update(teams).set({ imageUrl }).where(eq(teams.id, teamId));
      const [updated] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      return Response.json({ team: await teamBundle(updated) });
    }
    const seasonId = Number(body.seasonId);
    if (!teamId || !seasonId) return Response.json({ error: "Team and season are required." }, { status: 400 });
    const db = getDb();
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    const [season] = await db.select().from(teamSeasons).where(and(eq(teamSeasons.id, seasonId), eq(teamSeasons.teamId, teamId), isNull(teamSeasons.removedAt))).limit(1);
    if (!team || !season) return Response.json({ error: "That season could not be found for this team." }, { status: 404 });
    if (normalizePlayerName(team.name) !== "die bron") return Response.json({ error: "Only the Die Bron team can be managed in this portal." }, { status: 403 });
    if (body.action === "setRosterPlayerActive") {
      if (!season.isCurrent) return Response.json({ error: "Make this season current before changing its roster." }, { status: 409 });
      const seasonPlayerId = Number(body.seasonPlayerId);
      if (!seasonPlayerId) return Response.json({ error: "Choose a roster player." }, { status: 400 });
      const [rosterPlayer] = await db.select().from(seasonPlayerStats).where(and(
        eq(seasonPlayerStats.id, seasonPlayerId),
        eq(seasonPlayerStats.teamSeasonId, season.id),
      )).limit(1);
      if (!rosterPlayer) return Response.json({ error: "That player is not part of the selected season roster." }, { status: 404 });
      const active = body.active === true;
      await db.update(seasonPlayerStats).set({ active }).where(eq(seasonPlayerStats.id, rosterPlayer.id));
      return Response.json({ team: await teamBundle(team), active, preservedPlayerHistory: true });
    }
    if (body.action === "editSeason") {
      const seasonName = String(body.seasonName ?? "").trim();
      const leagueName = String(body.leagueName ?? "").trim();
      const externalSeasonId = String(body.externalSeasonId ?? "").trim();
      if (!seasonName || !leagueName || !externalSeasonId) return Response.json({ error: "Season name, league and Season ID are required." }, { status: 400 });
      const duplicate = (await db.select().from(teamSeasons).where(and(eq(teamSeasons.teamId, teamId), eq(teamSeasons.externalSeasonId, externalSeasonId), isNull(teamSeasons.removedAt)))).find((item) => item.id !== seasonId);
      if (duplicate) return Response.json({ error: `Season ID ${externalSeasonId} already exists for this team.` }, { status: 409 });
      await db.update(teamSeasons).set({ name: seasonName, leagueName, externalSeasonId }).where(eq(teamSeasons.id, seasonId));
      return Response.json({ team: await teamBundle(team) });
    }
    await db.update(teamSeasons).set({ isCurrent: false }).where(eq(teamSeasons.teamId, teamId));
    await db.update(teamSeasons).set({ isCurrent: true }).where(eq(teamSeasons.id, seasonId));
    return Response.json({ team: await teamBundle(team) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not change the current season." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as { teamId?: number; seasonId?: number };
    const teamId = Number(body.teamId);
    const seasonId = Number(body.seasonId);
    if (!teamId || !seasonId) return Response.json({ error: "Team and season are required." }, { status: 400 });
    const db = getDb();
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    const [season] = await db.select().from(teamSeasons).where(and(eq(teamSeasons.id, seasonId), eq(teamSeasons.teamId, teamId), isNull(teamSeasons.removedAt))).limit(1);
    if (!team || !season) return Response.json({ error: "That season could not be found for this team." }, { status: 404 });
    if (normalizePlayerName(team.name) !== "die bron") return Response.json({ error: "Only the Die Bron team can be managed in this portal." }, { status: 403 });
    const [gameCount] = await db.select({ total: sql<number>`count(*)` }).from(syncedMatches).where(eq(syncedMatches.teamSeasonId, seasonId));
    if (Number(gameCount.total)) {
      return Response.json({ error: `Move or remove this season's ${Number(gameCount.total)} completed game${Number(gameCount.total) === 1 ? "" : "s"} before deleting it.` }, { status: 409 });
    }
    await db.delete(fixtures).where(eq(fixtures.teamSeasonId, seasonId));
    await db.update(teamSeasons).set({ removedAt: new Date().toISOString(), isCurrent: false }).where(eq(teamSeasons.id, seasonId));
    if (season.isCurrent) {
      const [nextSeason] = await db.select().from(teamSeasons).where(and(eq(teamSeasons.teamId, teamId), isNull(teamSeasons.removedAt))).orderBy(desc(teamSeasons.lastSyncedAt)).limit(1);
      if (nextSeason) await db.update(teamSeasons).set({ isCurrent: true }).where(eq(teamSeasons.id, nextSeason.id));
    }
    return Response.json({ team: await teamBundle(team), preservedPlayerHistory: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not delete that season." }, { status: 500 });
  }
}
