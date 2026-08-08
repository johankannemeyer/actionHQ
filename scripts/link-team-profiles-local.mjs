import { DatabaseSync } from "node:sqlite";

const normalizeName = (value) => value
  .replace(/^\s*\d+\s*/, "")
  .replace(/\bunknown\b/gi, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

const [databasePath, teamName] = process.argv.slice(2);
if (!databasePath || !teamName) {
  throw new Error("Usage: node link-team-profiles-local.mjs <database> <team-name>");
}

const db = new DatabaseSync(databasePath);
db.exec("PRAGMA foreign_keys = ON");
const rosterRows = db.prepare(`
  SELECT DISTINCT pp.id AS player_profile_id, pp.normalized_name
  FROM player_profiles pp
  INNER JOIN season_player_stats sps ON sps.player_profile_id = pp.id
  INNER JOIN team_seasons ts ON ts.id = sps.team_season_id
  INNER JOIN teams t ON t.id = ts.team_id
  WHERE lower(t.name) = lower(?)
`).all(teamName);
const performanceRows = db.prepare(`
  SELECT mp.id, mp.player_name
  FROM match_performances mp
  INNER JOIN synced_matches sm ON sm.id = mp.synced_match_id
  WHERE lower(mp.team_name) = lower(?) AND sm.removed_at IS NULL
  ORDER BY mp.id
`).all(teamName);
const existingRows = db.prepare(`
  SELECT pc.match_performance_id, pc.player_profile_id
  FROM performance_claims pc
  INNER JOIN match_performances mp ON mp.id = pc.match_performance_id
  INNER JOIN synced_matches sm ON sm.id = mp.synced_match_id
  WHERE lower(mp.team_name) = lower(?) AND sm.removed_at IS NULL
`).all(teamName);

const roster = new Map();
for (const row of rosterRows) {
  const ids = roster.get(row.normalized_name) ?? new Set();
  ids.add(Number(row.player_profile_id));
  roster.set(row.normalized_name, ids);
}
const existing = new Map(existingRows.map((row) => [Number(row.match_performance_id), Number(row.player_profile_id)]));
const insertClaim = db.prepare("INSERT INTO performance_claims (player_profile_id, match_performance_id) VALUES (?, ?)");
const result = { team: teamName, rosterProfiles: rosterRows.length, performances: performanceRows.length, linked: 0, alreadyLinked: 0, unmatched: [], ambiguous: [] };

db.exec("BEGIN IMMEDIATE");
try {
  for (const performance of performanceRows) {
    const ids = roster.get(normalizeName(performance.player_name));
    if (!ids?.size) { result.unmatched.push(performance.player_name); continue; }
    if (ids.size !== 1) { result.ambiguous.push(performance.player_name); continue; }
    const profileId = [...ids][0];
    if (existing.has(Number(performance.id))) {
      if (existing.get(Number(performance.id)) === profileId) result.alreadyLinked += 1;
      else result.ambiguous.push(performance.player_name);
      continue;
    }
    insertClaim.run(profileId, Number(performance.id));
    result.linked += 1;
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}

result.unmatched = [...new Set(result.unmatched)];
result.ambiguous = [...new Set(result.ambiguous)];
console.log(JSON.stringify(result, null, 2));
