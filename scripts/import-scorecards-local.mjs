import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const clean = (html) => html
  .replace(/<br\s*\/?>/gi, " ")
  .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "")
  .replace(/<[^>]+>/g, "")
  .replace(/&amp;/g, "&")
  .replace(/&nbsp;/g, " ")
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, " ")
  .trim();

const value = (text) => Number.parseFloat(text) || 0;

const cleanDelivery = (html) => html
  .replace(/<br\s*\/?>/gi, " ")
  .replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, "$1")
  .replace(/<[^>]+>/g, "")
  .replace(/&amp;/g, "&")
  .replace(/&nbsp;/g, " ")
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, " ")
  .trim();

const scorecardCode = (outcome) => outcome.replace(/\s+/g, "").toUpperCase();

function deliveryRunValue(outcome) {
  const code = scorecardCode(outcome);
  if (!code) return 0;
  if (/^\d+$/.test(code)) return Number(code);
  const assistedRuns = code.match(/^(?:W|WD|N|NB|IS|LS)(\d+)$/)?.[1];
  return assistedRuns ? Number(assistedRuns) : 0;
}

function isExtraOutcome(outcome) {
  return /^(?:W|WD|N|NB|IS|LS)\d*$/.test(scorecardCode(outcome));
}

function isDismissalOutcome(outcome) {
  return ["C", "B", "R", "S", "ST", "M", "HW", "LBW", "I", "OBS", "I/OBS"].includes(scorecardCode(outcome));
}

function cells(row) {
  return [...row.matchAll(/<td\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/td\s*>)/gi)].map((cell) => clean(cell[2] ?? ""));
}

function detailedCells(row) {
  return [...row.matchAll(/<td\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/td\s*>)/gi)].map((cell) => ({
    className: cell[1].match(/class=["']([^"']*)["']/i)?.[1] ?? "",
    colspan: Number.parseInt(cell[1].match(/colspan=["']?(\d+)/i)?.[1] ?? "1", 10),
    text: cleanDelivery(cell[2] ?? ""),
  }));
}

function parseInningsTable(tableHtml, inningsNumber, inningsTotal) {
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => detailedCells(row[1]));
  const battingTeam = rows[0]?.find((cell) => cell.className.includes("TeamHeader") && !/^Batting Team:?$/i.test(cell.text))?.text ?? "";
  if (!battingTeam) return null;
  const pairs = [];

  for (let rowIndex = 1; rowIndex + 3 < rows.length;) {
    const header = rows[rowIndex];
    const overHeaders = [];
    for (let cellIndex = 0; cellIndex < header.length; cellIndex += 1) {
      if (!header[cellIndex].className.includes("OverNo")) continue;
      const bowler = header[cellIndex + 1];
      if (bowler?.className.includes("Bwl")) {
        overHeaders.push({ overNumber: value(header[cellIndex].text), bowlerName: bowler.text, ballCount: bowler.colspan || 6 });
      }
    }
    if (!overHeaders.length) {
      rowIndex += 1;
      continue;
    }
    const batterOneRow = rows[rowIndex + 1];
    const batterTwoRow = rows[rowIndex + 2];
    const footerRow = rows[rowIndex + 3];
    if (!batterOneRow?.[0]?.className.includes("BatsmanCell") || !batterTwoRow?.[0]?.className.includes("BatsmanCell")) {
      rowIndex += 1;
      continue;
    }

    const batterOne = batterOneRow[0].text;
    const batterTwo = batterTwoRow[0].text;
    const footerTotals = footerRow.filter((cell) => cell.className.includes("TotalCell")).map((cell) => cell.text);
    const overs = [];
    let cursor = 1;
    for (let overIndex = 0; overIndex < overHeaders.length; overIndex += 1) {
      const over = overHeaders[overIndex];
      const batterOneBalls = batterOneRow.slice(cursor, cursor + over.ballCount).map((cell) => cell.text);
      const batterTwoBalls = batterTwoRow.slice(cursor, cursor + over.ballCount).map((cell) => cell.text);
      const batterOneTotal = value(batterOneRow[cursor + over.ballCount]?.text ?? "0");
      const batterTwoTotal = value(batterTwoRow[cursor + over.ballCount]?.text ?? "0");
      const summary = footerTotals[overIndex]?.match(/(-?\d+)\s*\/\s*(-?\d+)/);
      let facingBatter = batterOne;
      const deliveries = [];
      for (let ballIndex = 0; ballIndex < over.ballCount; ballIndex += 1) {
        const firstOutcome = batterOneBalls[ballIndex] ?? "";
        const secondOutcome = batterTwoBalls[ballIndex] ?? "";
        const batterName = firstOutcome ? batterOne : secondOutcome ? batterTwo : facingBatter;
        const outcome = firstOutcome || secondOutcome || "0";
        deliveries.push({
          ballNumber: ballIndex + 1,
          batterName,
          outcome,
          isExtra: isExtraOutcome(outcome),
        });
        facingBatter = batterName;
        if (deliveryRunValue(outcome) % 2 === 1) facingBatter = batterName === batterOne ? batterTwo : batterOne;
      }
      overs.push({
        overNumber: over.overNumber,
        bowlerName: over.bowlerName,
        wickets: summary ? value(summary[1]) : deliveries.filter((delivery) => isDismissalOutcome(delivery.outcome)).length,
        runs: summary ? value(summary[2]) : batterOneTotal + batterTwoTotal,
        batterOneTotal,
        batterTwoTotal,
        deliveries,
      });
      cursor += over.ballCount + 1;
    }
    const pairSummary = footerTotals[overHeaders.length];
    pairs.push({
      pairNumber: pairs.length + 1,
      batterOne,
      batterTwo,
      total: pairSummary === undefined ? overs.reduce((sum, over) => sum + over.runs, 0) : value(pairSummary),
      overs,
    });
    rowIndex += 4;
  }
  const pairTotal = pairs.reduce((sum, pair) => sum + pair.total, 0);
  return { inningsNumber, battingTeam, total: pairTotal || inningsTotal, pairs };
}

function parseScoresheet(html, sourceName) {
  if (/No scoresheet has been uploaded for this fixture/i.test(html)) {
    throw new Error("This fixture file does not contain a completed scorecard.");
  }
  const decodedLinks = html
    .replace(/%3d/gi, "=")
    .replace(/%3f/gi, "?")
    .replace(/%26/gi, "&")
    .replace(/&amp;/gi, "&");
  const fixtureId = decodedLinks.match(/FixtureId=(\d+)/i)?.[1]
    ?? sourceName.match(/(?:fixture[_ -]*)?(\d{6,})/i)?.[1]
    ?? "";
  if (!fixtureId) throw new Error("The uploaded scorecard does not contain a Fixture ID.");

  const title = clean(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/^Action Sports\s*-\s*/i, "");
  const titleParts = title.match(/^(.*?)\s+vs\s+(.*?)\s+\((.*?)\)$/i);
  if (!titleParts) throw new Error("That scoresheet could not be recognised.");
  const [, homeTeam, awayTeam, playedAt] = titleParts;

  const summary = html.match(/<table class="Summary">([\s\S]*?)<\/table>/i)?.[1] ?? "";
  const scoreRows = [...summary.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) => cells(row[1]))
    .filter((row) => row.length >= 6 && row[0] && !/skins/i.test(row[0]));
  const scoreFor = (teamName) => {
    const row = scoreRows.find((item) => item[0].toLowerCase() === teamName.toLowerCase());
    return value(row?.[5] ?? "0");
  };
  const summaryFor = (teamName) => {
    const row = scoreRows.find((item) => item[0].toLowerCase() === teamName.toLowerCase());
    return {
      skin1: value(row?.[1] ?? "0"),
      skin2: value(row?.[2] ?? "0"),
      skin3: value(row?.[3] ?? "0"),
      skin4: value(row?.[4] ?? "0"),
      skins: value(row?.[5]?.match(/\((\d+)\s+skins?\)/i)?.[1] ?? "0"),
      points: value(row?.[7] ?? "0"),
    };
  };

  const performances = [];
  const innings = [];
  for (const table of html.matchAll(/<table[^>]*class="OversTable"[^>]*>([\s\S]*?)<\/table>/gi)) {
    if (!table[1].includes("MatchSummaryCol") && table[1].includes("Batting Team:")) {
      const teamName = clean(table[1].match(/<td colspan="\d+" class="TeamHeader"[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "");
      const parsedInnings = parseInningsTable(table[1], innings.length + 1, scoreFor(teamName));
      if (parsedInnings) innings.push(parsedInnings);
      continue;
    }
    if (!table[1].includes("MatchSummaryCol")) continue;
    const teamName = clean(table[1].match(/<td class="TeamHeader"[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "Team");
    for (const row of table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const data = cells(row[1]);
      if (data.length !== 8 || data[0] === "Name") continue;
      performances.push({
        teamName,
        playerName: data[0],
        runs: value(data[1]),
        strikeRate: value(data[2]),
        oversBowled: value(data[3]),
        runsConceded: value(data[4]),
        wickets: value(data[5]),
        economy: value(data[6]),
        contribution: value(data[7]),
      });
    }
  }

  const homeSummary = summaryFor(homeTeam.trim());
  const awaySummary = summaryFor(awayTeam.trim());
  return {
    match: {
      fixtureId,
      scoresheetUrl: `uploaded:${encodeURIComponent(sourceName)}`,
      homeTeam: homeTeam.trim(),
      awayTeam: awayTeam.trim(),
      homeScore: scoreFor(homeTeam.trim()),
      awayScore: scoreFor(awayTeam.trim()),
      homeSkin1: homeSummary.skin1,
      homeSkin2: homeSummary.skin2,
      homeSkin3: homeSummary.skin3,
      homeSkin4: homeSummary.skin4,
      awaySkin1: awaySummary.skin1,
      awaySkin2: awaySummary.skin2,
      awaySkin3: awaySummary.skin3,
      awaySkin4: awaySummary.skin4,
      homeSkins: homeSummary.skins,
      awaySkins: awaySummary.skins,
      homePoints: homeSummary.points,
      awayPoints: awaySummary.points,
      playedAt: playedAt.trim(),
      playerOfMatch: clean(html.match(/Player of the match:\s*([^<]+)/i)?.[1] ?? ""),
      syncedAt: new Date().toISOString(),
    },
    performances,
    innings,
  };
}

const [databasePath, sourceDirectory] = process.argv.slice(2);
if (!databasePath || !sourceDirectory) {
  throw new Error("Usage: node import-scorecards-local.mjs <database> <scorecard-directory>");
}

const files = readdirSync(sourceDirectory)
  .filter((name) => /\.html?$/i.test(name))
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
const parsed = [];
const failed = [];
for (const fileName of files) {
  try {
    parsed.push({ fileName, ...parseScoresheet(readFileSync(join(sourceDirectory, fileName), "utf8"), fileName) });
  } catch (error) {
    failed.push({ fileName, error: error instanceof Error ? error.message : String(error) });
  }
}

const db = new DatabaseSync(databasePath);
db.exec("PRAGMA foreign_keys = ON");
const findMatch = db.prepare("SELECT id FROM synced_matches WHERE fixture_id = ?");
const insertMatch = db.prepare(`
  INSERT INTO synced_matches (
    fixture_id, scoresheet_url, home_team, away_team, home_score, away_score,
    home_skin_1, home_skin_2, home_skin_3, home_skin_4,
    away_skin_1, away_skin_2, away_skin_3, away_skin_4,
    home_skins, away_skins, home_points, away_points,
    played_at, player_of_match, removed_at, synced_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
`);
const updateMatch = db.prepare(`
  UPDATE synced_matches SET
    scoresheet_url = ?, home_team = ?, away_team = ?, home_score = ?, away_score = ?,
    home_skin_1 = ?, home_skin_2 = ?, home_skin_3 = ?, home_skin_4 = ?,
    away_skin_1 = ?, away_skin_2 = ?, away_skin_3 = ?, away_skin_4 = ?,
    home_skins = ?, away_skins = ?, home_points = ?, away_points = ?,
    played_at = ?, player_of_match = ?, removed_at = NULL, synced_at = ?
  WHERE id = ?
`);
const upsertPerformance = db.prepare(`
  INSERT INTO match_performances (
    synced_match_id, team_name, player_name, runs, strike_rate, overs_bowled,
    runs_conceded, wickets, economy, contribution
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(synced_match_id, team_name, player_name) DO UPDATE SET
    runs = excluded.runs,
    strike_rate = excluded.strike_rate,
    overs_bowled = excluded.overs_bowled,
    runs_conceded = excluded.runs_conceded,
    wickets = excluded.wickets,
    economy = excluded.economy,
    contribution = excluded.contribution
`);
const deleteInnings = db.prepare("DELETE FROM match_innings WHERE synced_match_id = ?");
const insertInnings = db.prepare("INSERT INTO match_innings (synced_match_id, innings_number, batting_team, total) VALUES (?, ?, ?, ?)");
const insertPair = db.prepare("INSERT INTO match_pairs (match_innings_id, pair_number, batter_one, batter_two, total) VALUES (?, ?, ?, ?, ?)");
const insertOver = db.prepare("INSERT INTO match_overs (match_pair_id, over_number, bowler_name, wickets, runs, batter_one_total, batter_two_total) VALUES (?, ?, ?, ?, ?, ?, ?)");
const insertDelivery = db.prepare("INSERT INTO match_deliveries (match_over_id, ball_number, batter_name, outcome, is_extra) VALUES (?, ?, ?, ?, ?)");

db.exec("BEGIN IMMEDIATE");
try {
  for (const item of parsed) {
    const match = item.match;
    const existing = findMatch.get(match.fixtureId);
    let matchId;
    if (existing) {
      matchId = Number(existing.id);
      updateMatch.run(
        match.scoresheetUrl, match.homeTeam, match.awayTeam, match.homeScore, match.awayScore,
        match.homeSkin1, match.homeSkin2, match.homeSkin3, match.homeSkin4,
        match.awaySkin1, match.awaySkin2, match.awaySkin3, match.awaySkin4,
        match.homeSkins, match.awaySkins, match.homePoints, match.awayPoints,
        match.playedAt, match.playerOfMatch, match.syncedAt, matchId,
      );
    } else {
      const result = insertMatch.run(
        match.fixtureId, match.scoresheetUrl, match.homeTeam, match.awayTeam, match.homeScore, match.awayScore,
        match.homeSkin1, match.homeSkin2, match.homeSkin3, match.homeSkin4,
        match.awaySkin1, match.awaySkin2, match.awaySkin3, match.awaySkin4,
        match.homeSkins, match.awaySkins, match.homePoints, match.awayPoints,
        match.playedAt, match.playerOfMatch, match.syncedAt,
      );
      matchId = Number(result.lastInsertRowid);
    }

    for (const performance of item.performances) {
      upsertPerformance.run(
        matchId, performance.teamName, performance.playerName, performance.runs,
        performance.strikeRate, performance.oversBowled, performance.runsConceded,
        performance.wickets, performance.economy, performance.contribution,
      );
    }

    deleteInnings.run(matchId);
    for (const inning of item.innings) {
      const inningsId = Number(insertInnings.run(matchId, inning.inningsNumber, inning.battingTeam, inning.total).lastInsertRowid);
      for (const pair of inning.pairs) {
        const pairId = Number(insertPair.run(inningsId, pair.pairNumber, pair.batterOne, pair.batterTwo, pair.total).lastInsertRowid);
        for (const over of pair.overs) {
          const overId = Number(insertOver.run(pairId, over.overNumber, over.bowlerName, over.wickets, over.runs, over.batterOneTotal, over.batterTwoTotal).lastInsertRowid);
          for (const delivery of over.deliveries) {
            insertDelivery.run(overId, delivery.ballNumber, delivery.batterName, delivery.outcome, delivery.isExtra ? 1 : 0);
          }
        }
      }
    }
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}

console.log(JSON.stringify({ imported: parsed.length, failed, fixtures: parsed.map((item) => item.match.fixtureId) }, null, 2));
