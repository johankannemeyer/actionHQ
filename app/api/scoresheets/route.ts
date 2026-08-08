import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { matchDeliveries, matchInnings, matchKudos, matchOvers, matchPairs, matchPerformances, syncedMatches, teamSeasons, teams } from "../../../db/schema";
import { linkMatchPerformancesToRoster } from "../../../lib/profile-linking";

const clean = (html: string) => html
  .replace(/<br\s*\/?>/gi, " ")
  .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "")
  .replace(/<[^>]+>/g, "")
  .replace(/&amp;/g, "&")
  .replace(/&nbsp;/g, " ")
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, " ")
  .trim();

const value = (text: string) => Number.parseFloat(text) || 0;

const cleanDelivery = (html: string) => html
  .replace(/<br\s*\/?>/gi, " ")
  .replace(/<sup[^>]*>([\s\S]*?)<\/sup>/gi, "$1")
  .replace(/<[^>]+>/g, "")
  .replace(/&amp;/g, "&")
  .replace(/&nbsp;/g, " ")
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, " ")
  .trim();

type DetailedCell = { className: string; colspan: number; text: string };
type ParsedDelivery = { ballNumber: number; batterName: string; outcome: string; isExtra: boolean };
type ParsedOver = { overNumber: number; bowlerName: string; wickets: number; runs: number; batterOneTotal: number; batterTwoTotal: number; deliveries: ParsedDelivery[] };
type ParsedPair = { pairNumber: number; batterOne: string; batterTwo: string; total: number; overs: ParsedOver[] };
type ParsedInnings = { inningsNumber: number; battingTeam: string; total: number; pairs: ParsedPair[] };

const scorecardCode = (outcome: string) => outcome.replace(/\s+/g, "").toUpperCase();

function deliveryRunValue(outcome: string) {
  const code = scorecardCode(outcome);
  if (!code) return 0;
  if (/^\d+$/.test(code)) return Number(code);
  const assistedRuns = code.match(/^(?:W|WD|N|NB|IS|LS)(\d+)$/)?.[1];
  return assistedRuns ? Number(assistedRuns) : 0;
}

function isExtraOutcome(outcome: string) {
  const code = scorecardCode(outcome);
  return /^(?:W|WD|N|NB|IS|LS)\d*$/.test(code);
}

function isDismissalOutcome(outcome: string) {
  return ["C", "B", "R", "S", "ST", "M", "HW", "LBW", "I", "OBS", "I/OBS"].includes(scorecardCode(outcome));
}

function cells(row: string) {
  return [...row.matchAll(/<td\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/td\s*>)/gi)].map((cell) => clean(cell[2] ?? ""));
}

function detailedCells(row: string): DetailedCell[] {
  return [...row.matchAll(/<td\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/td\s*>)/gi)].map((cell) => ({
    className: cell[1].match(/class=["']([^"']*)["']/i)?.[1] ?? "",
    colspan: Number.parseInt(cell[1].match(/colspan=["']?(\d+)/i)?.[1] ?? "1", 10),
    text: cleanDelivery(cell[2] ?? ""),
  }));
}

function parseInningsTable(tableHtml: string, inningsNumber: number, inningsTotal: number): ParsedInnings | null {
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => detailedCells(row[1]));
  const battingTeam = rows[0]?.find((cell) => cell.className.includes("TeamHeader") && !/^Batting Team:?$/i.test(cell.text))?.text ?? "";
  if (!battingTeam) return null;
  const pairs: ParsedPair[] = [];

  for (let rowIndex = 1; rowIndex + 3 < rows.length;) {
    const header = rows[rowIndex];
    const overHeaders: Array<{ overNumber: number; bowlerName: string; ballCount: number }> = [];
    for (let cellIndex = 0; cellIndex < header.length; cellIndex += 1) {
      if (!header[cellIndex].className.includes("OverNo")) continue;
      const bowler = header[cellIndex + 1];
      if (bowler?.className.includes("Bwl")) overHeaders.push({ overNumber: value(header[cellIndex].text), bowlerName: bowler.text, ballCount: bowler.colspan || 6 });
    }
    if (!overHeaders.length) { rowIndex += 1; continue; }
    const batterOneRow = rows[rowIndex + 1];
    const batterTwoRow = rows[rowIndex + 2];
    const footerRow = rows[rowIndex + 3];
    if (!batterOneRow?.[0]?.className.includes("BatsmanCell") || !batterTwoRow?.[0]?.className.includes("BatsmanCell")) { rowIndex += 1; continue; }

    const batterOne = batterOneRow[0].text;
    const batterTwo = batterTwoRow[0].text;
    const footerTotals = footerRow.filter((cell) => cell.className.includes("TotalCell")).map((cell) => cell.text);
    const overs: ParsedOver[] = [];
    let cursor = 1;
    for (let overIndex = 0; overIndex < overHeaders.length; overIndex += 1) {
      const over = overHeaders[overIndex];
      const batterOneBalls = batterOneRow.slice(cursor, cursor + over.ballCount).map((cell) => cell.text);
      const batterTwoBalls = batterTwoRow.slice(cursor, cursor + over.ballCount).map((cell) => cell.text);
      const batterOneTotal = value(batterOneRow[cursor + over.ballCount]?.text ?? "0");
      const batterTwoTotal = value(batterTwoRow[cursor + over.ballCount]?.text ?? "0");
      const summary = footerTotals[overIndex]?.match(/(-?\d+)\s*\/\s*(-?\d+)/);
      let facingBatter = batterOne;
      const deliveries: ParsedDelivery[] = [];
      for (let ballIndex = 0; ballIndex < over.ballCount; ballIndex += 1) {
        const firstOutcome = batterOneBalls[ballIndex] ?? "";
        const secondOutcome = batterTwoBalls[ballIndex] ?? "";
        const batterName = firstOutcome ? batterOne : secondOutcome ? batterTwo : facingBatter;
        const outcome = firstOutcome || secondOutcome || "0";
        deliveries.push({ ballNumber: ballIndex + 1, batterName, outcome, isExtra: isExtraOutcome(outcome) });
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
    pairs.push({ pairNumber: pairs.length + 1, batterOne, batterTwo, total: pairSummary === undefined ? overs.reduce((sum, over) => sum + over.runs, 0) : value(pairSummary), overs });
    rowIndex += 4;
  }
  const pairTotal = pairs.reduce((sum, pair) => sum + pair.total, 0);
  return { inningsNumber, battingTeam, total: pairTotal || inningsTotal, pairs };
}

function parseScoresheet(html: string, sourceName: string, sourceUrl?: string) {
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
  const scoresheetUrl = sourceUrl ?? `uploaded:${encodeURIComponent(sourceName)}`;

  const title = clean(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/^Action Sports\s*-\s*/i, "");
  const titleParts = title.match(/^(.*?)\s+vs\s+(.*?)\s+\((.*?)\)$/i);
  if (!titleParts) throw new Error("That scoresheet could not be recognised.");
  const [, homeTeam, awayTeam, playedAt] = titleParts;

  const summary = html.match(/<table class="Summary">([\s\S]*?)<\/table>/i)?.[1] ?? "";
  const scoreRows = [...summary.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) => cells(row[1]))
    .filter((row) => row.length >= 6 && row[0] && !/skins/i.test(row[0]));
  const scoreFor = (teamName: string) => {
    const row = scoreRows.find((item) => item[0].toLowerCase() === teamName.toLowerCase());
    return value(row?.[5] ?? "0");
  };
  const summaryFor = (teamName: string) => {
    const row = scoreRows.find((item) => item[0].toLowerCase() === teamName.toLowerCase());
    return {
      skin1: value(row?.[1] ?? "0"), skin2: value(row?.[2] ?? "0"), skin3: value(row?.[3] ?? "0"), skin4: value(row?.[4] ?? "0"),
      skins: value(row?.[5]?.match(/\((\d+)\s+skins?\)/i)?.[1] ?? "0"), points: value(row?.[7] ?? "0"),
    };
  };

  const performances: Array<Omit<typeof matchPerformances.$inferInsert, "id" | "syncedMatchId">> = [];
  const innings: ParsedInnings[] = [];
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
      performances.push({ teamName, playerName: data[0], runs: value(data[1]), strikeRate: value(data[2]), oversBowled: value(data[3]), runsConceded: value(data[4]), wickets: value(data[5]), economy: value(data[6]), contribution: value(data[7]) });
    }
  }

  const homeSummary = summaryFor(homeTeam.trim());
  const awaySummary = summaryFor(awayTeam.trim());
  return {
    match: { fixtureId, scoresheetUrl, homeTeam: homeTeam.trim(), awayTeam: awayTeam.trim(), homeScore: scoreFor(homeTeam.trim()), awayScore: scoreFor(awayTeam.trim()), homeSkin1: homeSummary.skin1, homeSkin2: homeSummary.skin2, homeSkin3: homeSummary.skin3, homeSkin4: homeSummary.skin4, awaySkin1: awaySummary.skin1, awaySkin2: awaySummary.skin2, awaySkin3: awaySummary.skin3, awaySkin4: awaySummary.skin4, homeSkins: homeSummary.skins, awaySkins: awaySummary.skins, homePoints: homeSummary.points, awayPoints: awaySummary.points, playedAt: playedAt.trim(), playerOfMatch: clean(html.match(/Player of the match:\s*([^<]+)/i)?.[1] ?? ""), syncedAt: new Date().toISOString() },
    performances,
    innings,
  };
}

async function bundle(match: typeof syncedMatches.$inferSelect) {
  const db = getDb();
  const [performances, savedInnings] = await Promise.all([
    db.select().from(matchPerformances).where(eq(matchPerformances.syncedMatchId, match.id)).orderBy(desc(matchPerformances.contribution)),
    db.select().from(matchInnings).where(eq(matchInnings.syncedMatchId, match.id)).orderBy(asc(matchInnings.inningsNumber)),
  ]);
  const innings = await Promise.all(savedInnings.map(async (inning) => {
    const pairs = await db.select().from(matchPairs).where(eq(matchPairs.matchInningsId, inning.id)).orderBy(asc(matchPairs.pairNumber));
    return { ...inning, pairs: await Promise.all(pairs.map(async (pair) => {
      const overs = await db.select().from(matchOvers).where(eq(matchOvers.matchPairId, pair.id)).orderBy(asc(matchOvers.overNumber));
      return { ...pair, overs: await Promise.all(overs.map(async (over) => ({ ...over, deliveries: await db.select().from(matchDeliveries).where(eq(matchDeliveries.matchOverId, over.id)).orderBy(asc(matchDeliveries.ballNumber)) }))) };
    })) };
  }));
  return { ...match, performances, innings };
}

export async function GET() {
  try {
    const matches = await getDb().select().from(syncedMatches).where(isNull(syncedMatches.removedAt)).orderBy(desc(syncedMatches.fixtureId));
    return Response.json({ matches: await Promise.all(matches.map(bundle)) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load match activity." }, { status: 500 });
  }
}

async function saveParsedMatch(parsed: ReturnType<typeof parseScoresheet>, teamSeasonId: number | null, matchType: "league" | "friendly" | "grading") {
  const db = getDb();
  const [existing] = await db.select().from(syncedMatches).where(eq(syncedMatches.fixtureId, parsed.match.fixtureId)).limit(1);
  let match: typeof syncedMatches.$inferSelect;
  if (existing) {
    [match] = await db.update(syncedMatches).set({ ...parsed.match, matchType, teamSeasonId: teamSeasonId ?? existing.teamSeasonId, removedAt: null }).where(eq(syncedMatches.id, existing.id)).returning();
  } else {
    [match] = await db.insert(syncedMatches).values({ ...parsed.match, matchType, teamSeasonId }).returning();
  }
  for (const performance of parsed.performances) {
    const [savedPerformance] = await db.select().from(matchPerformances).where(and(
      eq(matchPerformances.syncedMatchId, match.id),
      eq(matchPerformances.teamName, performance.teamName),
      eq(matchPerformances.playerName, performance.playerName),
    )).limit(1);
    if (savedPerformance) await db.update(matchPerformances).set(performance).where(eq(matchPerformances.id, savedPerformance.id));
    else await db.insert(matchPerformances).values({ ...performance, syncedMatchId: match.id });
  }
  if (parsed.innings.length) {
    await db.delete(matchInnings).where(eq(matchInnings.syncedMatchId, match.id));
    for (const inning of parsed.innings) {
      const [savedInning] = await db.insert(matchInnings).values({ syncedMatchId: match.id, inningsNumber: inning.inningsNumber, battingTeam: inning.battingTeam, total: inning.total }).returning();
      for (const pair of inning.pairs) {
        const [savedPair] = await db.insert(matchPairs).values({ matchInningsId: savedInning.id, pairNumber: pair.pairNumber, batterOne: pair.batterOne, batterTwo: pair.batterTwo, total: pair.total }).returning();
        for (const over of pair.overs) {
          const [savedOver] = await db.insert(matchOvers).values({ matchPairId: savedPair.id, overNumber: over.overNumber, bowlerName: over.bowlerName, wickets: over.wickets, runs: over.runs, batterOneTotal: over.batterOneTotal, batterTwoTotal: over.batterTwoTotal }).returning();
          if (over.deliveries.length) await db.insert(matchDeliveries).values(over.deliveries.map((delivery) => ({ ...delivery, matchOverId: savedOver.id })));
        }
      }
    }
  }
  await linkMatchPerformancesToRoster(db, match.id);
  return bundle(match);
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const teamSeasonId = Number(form.get("teamSeasonId"));
    const uploads = form.getAll("scorecards").filter((entry): entry is File => entry instanceof File);
    const submittedUrl = String(form.get("scoresheetUrl") ?? "").trim();
    const submittedMatchType = String(form.get("matchType") ?? "league").trim().toLowerCase();
    if (!["league", "friendly", "grading"].includes(submittedMatchType)) return Response.json({ error: "Choose League, Friendly or Grading as the game type." }, { status: 400 });
    const matchType = submittedMatchType as "league" | "friendly" | "grading";
    if (!teamSeasonId) return Response.json({ error: "Choose the current team season before importing scorecards." }, { status: 400 });
    const [season] = await getDb().select({ id: teamSeasons.id, teamName: teams.name }).from(teamSeasons).innerJoin(teams, eq(teams.id, teamSeasons.teamId)).where(eq(teamSeasons.id, teamSeasonId)).limit(1);
    if (!season) return Response.json({ error: "That team season could not be found." }, { status: 404 });
    if (!uploads.length && !submittedUrl) return Response.json({ error: "Choose completed HTML files or paste an Action Sport scorecard URL." }, { status: 400 });
    if (uploads.length && submittedUrl) return Response.json({ error: "Choose one import method: HTML files or a scorecard URL." }, { status: 400 });
    if (uploads.length > 25) return Response.json({ error: "Upload no more than 25 scorecards at once." }, { status: 400 });

    const matches: Awaited<ReturnType<typeof bundle>>[] = [];
    const failed: Array<{ fileName: string; error: string }> = [];
    if (submittedUrl) {
      try {
        const url = new URL(submittedUrl);
        const fixtureId = url.searchParams.get("FixtureId") ?? "";
        if (url.protocol !== "https:" || url.hostname !== "actionsport.spawtz.com" || !url.pathname.toLowerCase().includes("/leagues/indoorcricket/scoresheet") || !/^\d+$/.test(fixtureId)) {
          throw new Error("Paste a valid Action Sport indoor-cricket scorecard URL containing a FixtureId.");
        }
        const db = getDb();
        const [existing] = await db.select().from(syncedMatches).where(eq(syncedMatches.fixtureId, fixtureId)).limit(1);
        if (existing) {
          const belongsToTeam = [existing.homeTeam, existing.awayTeam].some((name) => name.toLowerCase() === season.teamName.toLowerCase());
          const [updated] = await db.update(syncedMatches).set({ matchType, teamSeasonId: belongsToTeam ? teamSeasonId : null, removedAt: null }).where(eq(syncedMatches.id, existing.id)).returning();
          matches.push(await bundle(updated));
        } else {
          const response = await fetch(url, { headers: { "User-Agent": "ActionHQ Cricket Portal/1.0", Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
          if (!response.ok) throw new Error("Action Sport did not return that scorecard. Download its HTML and use the file option instead.");
          const html = await response.text();
          if (!html.length || html.length > 2_000_000) throw new Error("The downloaded scorecard was empty or too large.");
          const parsed = parseScoresheet(html, `Fixture ${fixtureId}`, url.toString());
          const belongsToTeam = [parsed.match.homeTeam, parsed.match.awayTeam].some((name) => name.toLowerCase() === season.teamName.toLowerCase());
          matches.push(await saveParsedMatch(parsed, belongsToTeam ? teamSeasonId : null, matchType));
        }
      } catch (error) {
        failed.push({ fileName: "Action Sport URL", error: error instanceof Error ? error.message : "Could not download that scorecard." });
      }
    }
    for (const upload of uploads) {
      try {
        if (!/\.html?$/i.test(upload.name)) throw new Error("Only .html or .htm scorecards are supported.");
        if (!upload.size || upload.size > 2_000_000) throw new Error("The scorecard must be between 1 byte and 2 MB.");
        const parsed = parseScoresheet(await upload.text(), upload.name);
        const belongsToTeam = [parsed.match.homeTeam, parsed.match.awayTeam].some((name) => name.toLowerCase() === season.teamName.toLowerCase());
        matches.push(await saveParsedMatch(parsed, belongsToTeam ? teamSeasonId : null, matchType));
      } catch (error) {
        failed.push({ fileName: upload.name, error: error instanceof Error ? error.message : "Could not read this scorecard." });
      }
    }
    if (!matches.length) return Response.json({ error: failed[0]?.error ?? "No scorecards could be imported.", failed }, { status: 400 });
    return Response.json({ matches, imported: matches.length, failed }, { status: failed.length ? 207 : 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not import these scorecards." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as { id?: number };
    const id = Number(body.id);
    if (!id) return Response.json({ error: "Match id is required." }, { status: 400 });
    const db = getDb();
    const [match] = await db.select().from(syncedMatches).where(eq(syncedMatches.id, id)).limit(1);
    if (!match) return Response.json({ error: "That game could not be found." }, { status: 404 });
    await db.update(syncedMatches).set({ removedAt: new Date().toISOString() }).where(eq(syncedMatches.id, id));
    return Response.json({ id, fixtureId: match.fixtureId });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not remove this game." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { id?: number; playerId?: number; teamSeasonId?: number };
    const id = Number(body.id);
    const playerId = Number(body.playerId);
    if (!id) return Response.json({ error: "Match id is required." }, { status: 400 });
    const db = getDb();
    if (body.teamSeasonId !== undefined) {
      const teamSeasonId = Number(body.teamSeasonId);
      const [season] = await db.select().from(teamSeasons).where(eq(teamSeasons.id, teamSeasonId)).limit(1);
      if (!season) return Response.json({ error: "That team season could not be found." }, { status: 404 });
      const [match] = await db.update(syncedMatches).set({ teamSeasonId }).where(eq(syncedMatches.id, id)).returning();
      if (!match) return Response.json({ error: "That match could not be found." }, { status: 404 });
      return Response.json({ match: await bundle(match) });
    }
    let liked = true;
    if (playerId) {
      const [existing] = await db.select().from(matchKudos).where(and(eq(matchKudos.syncedMatchId, id), eq(matchKudos.playerProfileId, playerId))).limit(1);
      if (existing) {
        await db.delete(matchKudos).where(eq(matchKudos.id, existing.id));
        liked = false;
      } else await db.insert(matchKudos).values({ syncedMatchId: id, playerProfileId: playerId });
    }
    const [match] = await db.update(syncedMatches).set({ kudos: liked ? sql`${syncedMatches.kudos} + 1` : sql`max(${syncedMatches.kudos} - 1, 0)` }).where(eq(syncedMatches.id, id)).returning();
    return Response.json({ match: { ...await bundle(match), liked } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not add kudos." }, { status: 500 });
  }
}
