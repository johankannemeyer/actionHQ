import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const numeric = (value) => Number.parseFloat(value) || 0;

const normalizeName = (value) => value
  .replace(/^\s*\d+\s*/, "")
  .replace(/\bunknown\b/gi, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

function decodeQuotedPrintable(value) {
  const unfolded = value.replace(/=\r?\n/g, "");
  const binary = unfolded.replace(/=([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
  return Buffer.from(binary, "latin1").toString("utf8");
}

function clean(value) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function seasonAverage(html, label) {
  const row = html.match(new RegExp(`${label}\\s*:\\s*</td><td>[^<]*</td><td>([^<]+)`, "i"));
  return numeric(clean(row?.[1] ?? "0"));
}

function parseProfile(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const html = decodeQuotedPrintable(raw);
  const sourceUrl = raw.match(/^Snapshot-Content-Location:\s*(https:\/\/[^\r\n]+)/im)?.[1]?.trim() ?? "";
  if (!sourceUrl) throw new Error("The saved team profile does not contain its source URL.");
  const url = new URL(sourceUrl);
  const id = (name) => url.searchParams.get(name) ?? "";
  const required = ["VenueId", "LeagueId", "SeasonId", "DivisionId", "TeamId"];
  if (required.some((name) => !id(name))) throw new Error("The team profile is missing one or more season identifiers.");

  const name = clean(html.match(/<title>([\s\S]*?)\s+Team Profile<\/title>/i)?.[1] ?? "Action Cricket Team");
  const position = numeric(html.match(/Current Season Position:\s*(\d+)/i)?.[1] ?? "0") || null;
  const record = html.match(/Current Season Record:\s*Won\s*(\d+),\s*Lost\s*(\d+),\s*Drawn\s*(\d+)/i);
  const rosterTable = html.match(/<table class="STTable">([\s\S]*?)<\/table>/i)?.[1] ?? "";
  const rosterRows = [...rosterTable.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) => [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => clean(cell[1])))
    .filter((row) => row.length === 13 && row[0] !== "Player");

  const grouped = new Map();
  for (const row of rosterRows) {
    const sourceName = row[0];
    const normalizedName = normalizeName(sourceName) || sourceName.toLowerCase().trim();
    const existing = grouped.get(normalizedName) ?? {
      sourceName,
      normalizedName,
      games: 0,
      runs: 0,
      timesOut: 0,
      oversBowled: 0,
      wickets: 0,
      runsConceded: 0,
      contribution: 0,
      estimatedBalls: 0,
    };
    const runs = numeric(row[2]);
    const strikeRate = numeric(row[4]);
    existing.games += numeric(row[1]);
    existing.runs += runs;
    existing.timesOut += numeric(row[5]);
    existing.oversBowled += numeric(row[6]);
    existing.wickets += numeric(row[7]);
    existing.runsConceded += numeric(row[9]);
    existing.contribution += numeric(row[11]);
    if (strikeRate) existing.estimatedBalls += Math.abs(runs / strikeRate * 100);
    grouped.set(normalizedName, existing);
  }

  const players = [...grouped.values()].map((player) => ({
    ...player,
    runsAverage: player.games ? player.runs / player.games : 0,
    strikeRate: player.estimatedBalls ? player.runs / player.estimatedBalls * 100 : 0,
    wicketAverage: player.games ? player.wickets / player.games : 0,
    runsConcededAverage: player.games ? player.runsConceded / player.games : 0,
    contributionAverage: player.games ? player.contribution / player.games : 0,
  }));

  const now = new Date().toISOString();
  return {
    team: {
      sourceUrl,
      externalTeamId: id("TeamId"),
      venueId: id("VenueId"),
      leagueId: id("LeagueId"),
      seasonId: id("SeasonId"),
      divisionId: id("DivisionId"),
      name,
      position,
      wins: numeric(record?.[1] ?? "0"),
      losses: numeric(record?.[2] ?? "0"),
      draws: numeric(record?.[3] ?? "0"),
      averageScored: seasonAverage(html, "Average Scored"),
      averageConceded: seasonAverage(html, "Average Conceded"),
      lastSyncedAt: now,
    },
    players,
    now,
  };
}

const [databasePath, profilePath] = process.argv.slice(2);
if (!databasePath || !profilePath) {
  throw new Error("Usage: node import-team-profile-local.mjs <database> <saved-team-profile.mhtml>");
}

const parsed = parseProfile(profilePath);
const db = new DatabaseSync(databasePath);
db.exec("PRAGMA foreign_keys = ON");

const findTeam = db.prepare("SELECT id FROM teams WHERE external_team_id = ? OR name = ? ORDER BY id LIMIT 1");
const updateTeam = db.prepare(`
  UPDATE teams SET source_url = ?, external_team_id = ?, venue_id = ?, league_id = ?, season_id = ?,
    division_id = ?, name = ?, position = ?, wins = ?, losses = ?, draws = ?, average_scored = ?,
    average_conceded = ?, last_synced_at = ? WHERE id = ?
`);
const findSeason = db.prepare("SELECT id FROM team_seasons WHERE team_id = ? AND external_season_id = ? AND external_division_id = ?");
const insertSeason = db.prepare(`
  INSERT INTO team_seasons (
    team_id, source_url, external_season_id, external_league_id, external_division_id,
    position, wins, losses, draws, average_scored, average_conceded, last_synced_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateSeason = db.prepare(`
  UPDATE team_seasons SET source_url = ?, external_league_id = ?, position = ?, wins = ?, losses = ?,
    draws = ?, average_scored = ?, average_conceded = ?, last_synced_at = ? WHERE id = ?
`);
const findProfile = db.prepare(`
  SELECT id FROM player_profiles WHERE normalized_name = ?
  ORDER BY registered_at IS NOT NULL DESC, id ASC LIMIT 1
`);
const insertProfile = db.prepare("INSERT INTO player_profiles (display_name, normalized_name) VALUES (?, ?)");
const insertStats = db.prepare(`
  INSERT INTO season_player_stats (
    team_season_id, player_profile_id, source_name, active, games, runs, runs_average,
    strike_rate, times_out, overs_bowled, wickets, wicket_average, runs_conceded,
    runs_conceded_average, contribution, contribution_average
  ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(team_season_id, player_profile_id) DO UPDATE SET
    source_name = excluded.source_name,
    active = 1,
    games = excluded.games,
    runs = excluded.runs,
    runs_average = excluded.runs_average,
    strike_rate = excluded.strike_rate,
    times_out = excluded.times_out,
    overs_bowled = excluded.overs_bowled,
    wickets = excluded.wickets,
    wicket_average = excluded.wicket_average,
    runs_conceded = excluded.runs_conceded,
    runs_conceded_average = excluded.runs_conceded_average,
    contribution = excluded.contribution,
    contribution_average = excluded.contribution_average
`);

db.exec("BEGIN IMMEDIATE");
try {
  const teamRow = findTeam.get(parsed.team.externalTeamId, parsed.team.name);
  if (!teamRow) throw new Error(`No existing ${parsed.team.name} team was found to replace.`);
  const teamId = Number(teamRow.id);
  const oldProfileIds = db.prepare(`
    SELECT DISTINCT sps.player_profile_id AS id
    FROM season_player_stats sps
    INNER JOIN team_seasons ts ON ts.id = sps.team_season_id
    WHERE ts.team_id = ? AND ts.external_season_id <> ?
  `).all(teamId, parsed.team.seasonId).map((row) => Number(row.id));

  updateTeam.run(
    parsed.team.sourceUrl,
    parsed.team.externalTeamId,
    parsed.team.venueId,
    parsed.team.leagueId,
    parsed.team.seasonId,
    parsed.team.divisionId,
    parsed.team.name,
    parsed.team.position,
    parsed.team.wins,
    parsed.team.losses,
    parsed.team.draws,
    parsed.team.averageScored,
    parsed.team.averageConceded,
    parsed.team.lastSyncedAt,
    teamId,
  );

  let seasonRow = findSeason.get(teamId, parsed.team.seasonId, parsed.team.divisionId);
  let seasonId;
  if (seasonRow) {
    seasonId = Number(seasonRow.id);
    updateSeason.run(
      parsed.team.sourceUrl,
      parsed.team.leagueId,
      parsed.team.position,
      parsed.team.wins,
      parsed.team.losses,
      parsed.team.draws,
      parsed.team.averageScored,
      parsed.team.averageConceded,
      parsed.now,
      seasonId,
    );
  } else {
    seasonId = Number(insertSeason.run(
      teamId,
      parsed.team.sourceUrl,
      parsed.team.seasonId,
      parsed.team.leagueId,
      parsed.team.divisionId,
      parsed.team.position,
      parsed.team.wins,
      parsed.team.losses,
      parsed.team.draws,
      parsed.team.averageScored,
      parsed.team.averageConceded,
      parsed.now,
    ).lastInsertRowid);
  }

  db.prepare("DELETE FROM team_seasons WHERE team_id = ? AND id <> ?").run(teamId, seasonId);
  db.prepare("DELETE FROM season_fixtures WHERE team_season_id = ?").run(seasonId);
  db.prepare("UPDATE season_player_stats SET active = 0 WHERE team_season_id = ?").run(seasonId);

  for (const player of parsed.players) {
    const profileRow = findProfile.get(player.normalizedName);
    const profileId = profileRow
      ? Number(profileRow.id)
      : Number(insertProfile.run(player.sourceName, player.normalizedName).lastInsertRowid);
    insertStats.run(
      seasonId,
      profileId,
      player.sourceName,
      player.games,
      player.runs,
      player.runsAverage,
      player.strikeRate,
      player.timesOut,
      player.oversBowled,
      player.wickets,
      player.wicketAverage,
      player.runsConceded,
      player.runsConcededAverage,
      player.contribution,
      player.contributionAverage,
    );
  }

  db.prepare("DELETE FROM players WHERE team_id = ?").run(teamId);
  db.prepare("DELETE FROM matches WHERE team_id = ?").run(teamId);
  db.prepare("DELETE FROM fixtures WHERE team_name = 'Your team'").run();

  const removeOrphan = db.prepare(`
    DELETE FROM player_profiles
    WHERE id = ?
      AND registered_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM season_player_stats WHERE player_profile_id = player_profiles.id)
      AND NOT EXISTS (SELECT 1 FROM performance_claims WHERE player_profile_id = player_profiles.id)
      AND NOT EXISTS (SELECT 1 FROM player_profile_links WHERE owner_profile_id = player_profiles.id OR source_profile_id = player_profiles.id)
      AND NOT EXISTS (SELECT 1 FROM team_invitations WHERE claimed_profile_id = player_profiles.id)
      AND NOT EXISTS (SELECT 1 FROM match_comments WHERE player_profile_id = player_profiles.id)
      AND NOT EXISTS (SELECT 1 FROM match_kudos WHERE player_profile_id = player_profiles.id)
      AND NOT EXISTS (SELECT 1 FROM challenge_entries WHERE player_profile_id = player_profiles.id)
      AND NOT EXISTS (SELECT 1 FROM player_follows WHERE follower_profile_id = player_profiles.id OR following_profile_id = player_profiles.id)
  `);
  for (const profileId of oldProfileIds) removeOrphan.run(profileId);

  db.exec("COMMIT");
  console.log(JSON.stringify({
    team: parsed.team.name,
    season: parsed.team.seasonId,
    removedOtherSeasons: true,
    importedPlayers: parsed.players.length,
    importedFixtures: 0,
  }, null, 2));
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
