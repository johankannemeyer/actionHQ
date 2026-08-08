import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { matchPerformances, performanceClaims, playerProfileLinks, playerProfiles, seasonPlayerStats, syncedMatches, teamSeasons, teams } from "../db/schema";

type Database = ReturnType<typeof getDb>;
type PerformanceRow = { id: number; playerName: string };

export const normalizePlayerName = (value: string) => value
  .replace(/^\s*\d+\s*/, "")
  .replace(/\bunknown\b/gi, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

function rosterMap(rows: Array<{ playerProfileId: number; normalizedName: string }>) {
  const profiles = new Map<string, Set<number>>();
  for (const row of rows) {
    const ids = profiles.get(row.normalizedName) ?? new Set<number>();
    ids.add(row.playerProfileId);
    profiles.set(row.normalizedName, ids);
  }
  return profiles;
}

export async function reconcileTeamPlayerProfiles(db: Database, teamId: number) {
  const rosterRows = await db.select({
    playerProfileId: playerProfiles.id,
    normalizedName: playerProfiles.normalizedName,
    registeredAt: playerProfiles.registeredAt,
  }).from(seasonPlayerStats)
    .innerJoin(playerProfiles, eq(seasonPlayerStats.playerProfileId, playerProfiles.id))
    .innerJoin(teamSeasons, eq(seasonPlayerStats.teamSeasonId, teamSeasons.id))
    .where(eq(teamSeasons.teamId, teamId));
  const profilesByName = new Map<string, Map<number, { id: number; registeredAt: string | null }>>();
  for (const row of rosterRows) {
    const profiles = profilesByName.get(row.normalizedName) ?? new Map<number, { id: number; registeredAt: string | null }>();
    profiles.set(row.playerProfileId, { id: row.playerProfileId, registeredAt: row.registeredAt });
    profilesByName.set(row.normalizedName, profiles);
  }
  const profileIds = [...new Set(rosterRows.map((row) => row.playerProfileId))];
  if (!profileIds.length) return { linked: 0, skipped: 0 };
  const links: Array<typeof playerProfileLinks.$inferSelect> = [];
  const claims: Array<{ playerProfileId: number }> = [];
  for (let index = 0; index < profileIds.length; index += 50) {
    const profileIdBatch = profileIds.slice(index, index + 50);
    const [batchLinks, batchClaims] = await Promise.all([
      db.select().from(playerProfileLinks).where(inArray(playerProfileLinks.sourceProfileId, profileIdBatch)),
      db.select({ playerProfileId: performanceClaims.playerProfileId }).from(performanceClaims).where(inArray(performanceClaims.playerProfileId, profileIdBatch)),
    ]);
    links.push(...batchLinks); claims.push(...batchClaims);
  }
  const linkBySource = new Map(links.map((link) => [link.sourceProfileId, link]));
  const ownerIds = new Set(links.map((link) => link.ownerProfileId));
  const claimCounts = new Map<number, number>();
  for (const claim of claims) claimCounts.set(claim.playerProfileId, (claimCounts.get(claim.playerProfileId) ?? 0) + 1);
  const result = { linked: 0, skipped: 0 };

  for (const profiles of profilesByName.values()) {
    const candidates = [...profiles.values()];
    if (candidates.length < 2) continue;
    const registered = candidates.filter((profile) => profile.registeredAt);
    if (registered.length > 1) { result.skipped += candidates.length - 1; continue; }
    const canonical = [...candidates].sort((first, second) => {
      if (!!first.registeredAt !== !!second.registeredAt) return first.registeredAt ? -1 : 1;
      const claimDifference = (claimCounts.get(second.id) ?? 0) - (claimCounts.get(first.id) ?? 0);
      return claimDifference || first.id - second.id;
    })[0];
    for (const duplicate of candidates) {
      if (duplicate.id === canonical.id) continue;
      const existingLink = linkBySource.get(duplicate.id);
      if (existingLink?.ownerProfileId === canonical.id) continue;
      if (existingLink || duplicate.registeredAt || ownerIds.has(duplicate.id)) { result.skipped += 1; continue; }
      await db.insert(playerProfileLinks).values({ ownerProfileId: canonical.id, sourceProfileId: duplicate.id });
      linkBySource.set(duplicate.id, { id: 0, ownerProfileId: canonical.id, sourceProfileId: duplicate.id, linkedAt: new Date().toISOString() });
      result.linked += 1;
    }
  }
  return result;
}

async function linkRows(db: Database, performances: PerformanceRow[], profiles: Map<string, Set<number>>) {
  if (!performances.length) return { linked: 0, alreadyLinked: 0, unmatched: 0, ambiguous: 0 };
  const existingClaims: Array<typeof performanceClaims.$inferSelect> = [];
  const performanceIds = performances.map((row) => row.id);
  for (let index = 0; index < performanceIds.length; index += 50) {
    existingClaims.push(...await db.select().from(performanceClaims).where(inArray(performanceClaims.matchPerformanceId, performanceIds.slice(index, index + 50))));
  }
  const claimsByPerformance = new Map(existingClaims.map((claim) => [claim.matchPerformanceId, claim]));
  const result = { linked: 0, alreadyLinked: 0, unmatched: 0, ambiguous: 0 };

  for (const performance of performances) {
    const candidates = profiles.get(normalizePlayerName(performance.playerName));
    if (!candidates?.size) { result.unmatched += 1; continue; }
    if (candidates.size !== 1) { result.ambiguous += 1; continue; }
    const playerProfileId = [...candidates][0];
    const existing = claimsByPerformance.get(performance.id);
    if (existing) {
      if (existing.playerProfileId === playerProfileId) result.alreadyLinked += 1;
      else result.ambiguous += 1;
      continue;
    }
    await db.insert(performanceClaims).values({ playerProfileId, matchPerformanceId: performance.id });
    result.linked += 1;
  }
  return result;
}

export async function linkTeamPerformancesToRoster(db: Database, teamId: number) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return { linked: 0, alreadyLinked: 0, unmatched: 0, ambiguous: 0 };
  const [rosterRows, performances] = await Promise.all([
    db.select({
      playerProfileId: sql<number>`coalesce(${playerProfileLinks.ownerProfileId}, ${playerProfiles.id})`,
      normalizedName: playerProfiles.normalizedName,
    }).from(seasonPlayerStats)
      .innerJoin(playerProfiles, eq(seasonPlayerStats.playerProfileId, playerProfiles.id))
      .leftJoin(playerProfileLinks, eq(playerProfileLinks.sourceProfileId, playerProfiles.id))
      .innerJoin(teamSeasons, eq(seasonPlayerStats.teamSeasonId, teamSeasons.id))
      .where(eq(teamSeasons.teamId, teamId)),
    db.select({ id: matchPerformances.id, playerName: matchPerformances.playerName })
      .from(matchPerformances)
      .innerJoin(syncedMatches, eq(matchPerformances.syncedMatchId, syncedMatches.id))
      .where(and(
        sql<boolean>`lower(${matchPerformances.teamName}) = ${team.name.toLowerCase()}`,
        isNull(syncedMatches.removedAt),
      )),
  ]);
  return linkRows(db, performances, rosterMap(rosterRows));
}

export async function linkMatchPerformancesToRoster(db: Database, syncedMatchId: number) {
  const performances = await db.select({
    id: matchPerformances.id,
    playerName: matchPerformances.playerName,
    teamName: matchPerformances.teamName,
  }).from(matchPerformances).where(eq(matchPerformances.syncedMatchId, syncedMatchId));
  const totals = { linked: 0, alreadyLinked: 0, unmatched: 0, ambiguous: 0 };

  for (const teamName of new Set(performances.map((row) => row.teamName))) {
    const matchingPerformances = performances.filter((row) => row.teamName === teamName);
    const rosterRows = await db.select({
      playerProfileId: sql<number>`coalesce(${playerProfileLinks.ownerProfileId}, ${playerProfiles.id})`,
      normalizedName: playerProfiles.normalizedName,
    }).from(seasonPlayerStats)
      .innerJoin(playerProfiles, eq(seasonPlayerStats.playerProfileId, playerProfiles.id))
      .leftJoin(playerProfileLinks, eq(playerProfileLinks.sourceProfileId, playerProfiles.id))
      .innerJoin(teamSeasons, eq(seasonPlayerStats.teamSeasonId, teamSeasons.id))
      .innerJoin(teams, eq(teamSeasons.teamId, teams.id))
      .where(sql<boolean>`lower(${teams.name}) = ${teamName.toLowerCase()}`);
    const linked = await linkRows(db, matchingPerformances, rosterMap(rosterRows));
    totals.linked += linked.linked;
    totals.alreadyLinked += linked.alreadyLinked;
    totals.unmatched += linked.unmatched;
    totals.ambiguous += linked.ambiguous;
  }
  return totals;
}
