"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useState, createContext, useContext } from "react";
import type { ReactNode } from "react";

type Player = { id: number; playerProfileId?: number; linkedOwnerId?: number | null; linkedAppearances?: number; name: string; active?: boolean; registeredAt?: string | null; games: number; runs: number; runsAverage: number; strikeRate: number; wickets: number; contribution: number; contributionAverage: number };
type Fixture = { id: number; round: string; matchDate: string; matchTime: string; court: string; opponent: string; result: string };
type Season = { id: number; name: string; leagueName: string; externalSeasonId: string; externalDivisionId: string; sourceUrl: string; isCurrent: boolean; position: number | null; wins: number; losses: number; draws: number; averageScored: number; averageConceded: number; lastSyncedAt: string; players: Player[]; matches: Fixture[] };
type Team = { id: number; name: string; sourceUrl: string; position: number | null; wins: number; losses: number; draws: number; averageScored: number; averageConceded: number; imageUrl: string | null; lastSyncedAt: string; players: Player[]; matches: Fixture[]; seasons: Season[] };
type Performance = { id: number; teamName: string; playerName: string; runs: number; strikeRate: number; oversBowled: number; runsConceded: number; wickets: number; economy: number; contribution: number };
type MatchDelivery = { id: number; ballNumber: number; batterName: string; outcome: string; isExtra: boolean };
type MatchOver = { id: number; overNumber: number; bowlerName: string; wickets: number; runs: number; batterOneTotal: number; batterTwoTotal: number; deliveries: MatchDelivery[] };
type MatchPair = { id: number; pairNumber: number; batterOne: string; batterTwo: string; total: number; overs: MatchOver[] };
type MatchInnings = { id: number; inningsNumber: number; battingTeam: string; total: number; pairs: MatchPair[] };
type MatchType = "league" | "friendly" | "grading";
type MatchActivity = { id: number; teamSeasonId: number | null; fixtureId: string; scoresheetUrl: string; matchType: MatchType; homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; homeSkin1: number; homeSkin2: number; homeSkin3: number; homeSkin4: number; awaySkin1: number; awaySkin2: number; awaySkin3: number; awaySkin4: number; homeSkins: number; awaySkins: number; homePoints: number; awayPoints: number; playedAt: string; playerOfMatch: string; kudos: number; removedAt?: string | null; liked?: boolean; performances: Performance[]; innings: MatchInnings[] };
type PlayerMatch = { claimId: number; teamSeasonId: number | null; fixtureId: string; playedAt: string; homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; scoresheetUrl: string; teamName: string; playerName: string; runs: number; strikeRate: number; wickets: number; contribution: number };
type PlayerSeason = { id: number; teamSeasonId: number; seasonId: string; divisionId: string; teamName: string; sourceName: string; active: boolean; games: number; runs: number; strikeRate: number; wickets: number; contribution: number; contributionAverage: number; lastSyncedAt: string };
type TeamProfileCandidate = { sourceProfileId: number; sourceName: string; teams: Array<{ teamName: string; seasonId: string; divisionId: string; games: number; runs: number; wickets: number }> };
type PlayerProfile = { id: number; displayName: string; email: string | null; phone: string | null; bio: string; role: string; preferredVenue: string; registeredAt: string | null; imageUrl: string | null; linkedSourceIds: number[]; linkCandidates: TeamProfileCandidate[]; allTime: { games: number; runs: number; wickets: number; contribution: number; strikeRate: number; seasons: number; linkedMatches: number; fillerMatches: number }; seasons: PlayerSeason[]; matches: PlayerMatch[] };
type ScorecardCandidate = { name: string; teamName: string };
type Follow = { id: number; followerProfileId: number; followingProfileId: number; createdAt: string };
type View = "feed" | "performance" | "team" | "players" | "leaderboards" | "consistency" | "fixtures" | "search" | "player" | "account" | "privacy" | "scorecard";
type RankingMetric = "impact" | "runs" | "wickets" | "runsAverage" | "strikeRate";
type RankingTableSort = RankingMetric | "games" | "name";
type RankingParticipationFilter = "all" | "played" | "waiting";
type RankingSortDirection = "asc" | "desc";
type TeamStatsMatchFilter = "all" | MatchType;
type TeamStatsResultFilter = "all" | "win" | "loss" | "draw";
type TeamStatsSort = "oldest" | "newest";
type PlayerDirectorySort = "name" | "games" | "runs" | "wickets" | "impact";

const rankingMetricOptions: Array<{ id: RankingMetric; label: string; short: string; description: string }> = [
  { id: "impact", label: "Overall impact", short: "C", description: "Total contribution" },
  { id: "runs", label: "Runs", short: "R", description: "Total runs scored" },
  { id: "wickets", label: "Wickets", short: "W", description: "Total wickets taken" },
  { id: "runsAverage", label: "Runs average", short: "RA", description: "Runs per game" },
  { id: "strikeRate", label: "Strike rate", short: "SR", description: "Batting strike rate" },
];

function rankingMetricValue(player: Player, metric: RankingMetric) {
  if (metric === "runs") return player.runs;
  if (metric === "wickets") return player.wickets;
  if (metric === "runsAverage") return player.runsAverage;
  if (metric === "strikeRate") return player.strikeRate;
  return player.contribution;
}

function rankingMetricDisplay(player: Player, metric: RankingMetric) {
  const value = rankingMetricValue(player, metric);
  if (metric === "impact") return `${value > 0 ? "+" : ""}${value}`;
  return value.toLocaleString("en-ZA", { maximumFractionDigits: metric === "runs" || metric === "wickets" ? 0 : 1 });
}

function rankingTableValue(player: Player, sort: RankingTableSort) {
  if (sort === "name") return 0;
  if (sort === "games") return player.games;
  return rankingMetricValue(player, sort);
}

function rankingTableDisplay(player: Player, sort: RankingTableSort) {
  if (sort === "name") return `${player.games} game${player.games === 1 ? "" : "s"}`;
  if (sort === "games") return `${player.games} G`;
  const metric = rankingMetricOptions.find((item) => item.id === sort);
  return `${rankingMetricDisplay(player, sort)} ${metric?.short ?? ""}`.trim();
}

const PlayerImageContext = createContext<Map<string, string> | null>(null);

function Initials({ name, large = false, src = null }: { name: string; large?: boolean; src?: string | null }) {
  const imageMap = useContext(PlayerImageContext);
  const resolved = src ?? (name ? imageMap?.get(playerKey(name)) ?? null : null);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
  const className = `avatar${large ? " avatar-large" : ""}${resolved ? " has-photo" : ""}`;
  return <span className={className}>{resolved ? <img src={resolved} alt={name} /> : (initials || "AH")}</span>;
}

async function readImageThumbnail(file: File, max = 256): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new window.Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not decode the image."));
    element.src = dataUrl;
  });
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function matchTypeLabel(matchType?: MatchType) {
  if (matchType === "friendly") return "Friendly";
  if (matchType === "grading") return "Grading";
  return "League";
}

function scorecardCode(outcome: string) {
  return outcome.trim().replace(/\s+/g, "").toUpperCase();
}

function isWideOutcome(outcome: string) {
  return /^(?:W|WD)\d*$/.test(scorecardCode(outcome));
}

function isNoBallOutcome(outcome: string) {
  return /^(?:N|NB)\d*$/.test(scorecardCode(outcome));
}

function isLegsideOutcome(outcome: string) {
  return /^(?:IS|LS)\d*$/.test(scorecardCode(outcome));
}

function isExtraOutcome(outcome: string) {
  return isWideOutcome(outcome) || isNoBallOutcome(outcome) || isLegsideOutcome(outcome);
}

function isDismissalOutcome(outcome: string) {
  return ["C", "B", "R", "S", "ST", "M", "HW", "LBW", "I", "OBS", "I/OBS"].includes(scorecardCode(outcome));
}

function deliveryRunValue(outcome: string) {
  const code = scorecardCode(outcome);
  if (!code) return 0;
  if (/^\d+$/.test(code)) return Number(code);
  const assistedRuns = code.match(/^(?:W|WD|N|NB|IS|LS)(\d+)$/)?.[1];
  return assistedRuns ? Number(assistedRuns) : null;
}

function dismissalLabel(outcome: string) {
  const labels: Record<string, string> = { C: "Caught", B: "Bowled", R: "Run out", S: "Stumped", ST: "Stumped", M: "Mankad", HW: "Hit wicket", LBW: "LBW", I: "Interference / obstruction", OBS: "Interference / obstruction", "I/OBS": "Interference / obstruction" };
  return labels[scorecardCode(outcome)] ?? "Other";
}

function TeamPerformanceCharts({ teamName, matches, sortOrder }: { teamName: string; matches: MatchActivity[]; sortOrder: TeamStatsSort }) {
  const teamMatches = matches.filter((match) => match.homeTeam.toLowerCase() === teamName.toLowerCase() || match.awayTeam.toLowerCase() === teamName.toLowerCase());
  const analysed = teamMatches.map((match) => {
    const home = match.homeTeam.toLowerCase() === teamName.toLowerCase();
    const scored = home ? match.homeScore : match.awayScore;
    const conceded = home ? match.awayScore : match.homeScore;
    const skins = home ? match.homeSkins : match.awaySkins;
    return { ...match, scored, conceded, skins, opponent: home ? match.awayTeam : match.homeTeam, result: scored > conceded ? "W" : scored < conceded ? "L" : "D" };
  });
  const recent = sortOrder === "newest" ? analysed.slice(0, 8) : analysed.slice(-8);
  if (!recent.length) return <section className="analytics-panel"><div className="section-title"><div><p className="overline">TEAM PERFORMANCE</p><h2>Form charts</h2></div></div><div className="panel-empty">Upload the first completed HTML scorecard to unlock team scoring, results and skins charts.</div></section>;

  type TeamPlayerIntelligence = { name: string; balls: number; dots: number; rotations: number; dismissals: number; wickets: number; bowlingBalls: number; bowlingDots: number; extras: number };
  const playerIntelligence = new Map<string, TeamPlayerIntelligence>();
  const playerRecord = (name: string) => {
    const key = playerKey(name);
    const current = playerIntelligence.get(key) ?? { name, balls: 0, dots: 0, rotations: 0, dismissals: 0, wickets: 0, bowlingBalls: 0, bowlingDots: 0, extras: 0 };
    playerIntelligence.set(key, current);
    return current;
  };
  const dismissalCounts = new Map<string, number>();
  const teamRunTypes = { dots: 0, ones: 0, twos: 0, threes: 0, fours: 0, fives: 0, sixes: 0, sevensPlus: 0, dismissals: 0 };
  for (const match of teamMatches) {
    for (const innings of match.innings ?? []) {
      const teamBatting = innings.battingTeam.toLowerCase() === teamName.toLowerCase();
      for (const pair of innings.pairs ?? []) {
        for (const over of pair.overs ?? []) {
          if (!teamBatting && over.bowlerName.trim()) {
            const bowler = playerRecord(over.bowlerName);
            bowler.wickets += over.wickets;
            bowler.bowlingBalls += over.deliveries?.length ?? 0;
            bowler.bowlingDots += (over.deliveries ?? []).filter((delivery) => deliveryRunValue(delivery.outcome) === 0).length;
            bowler.extras += (over.deliveries ?? []).filter((delivery) => isExtraOutcome(delivery.outcome)).length;
          }
          if (!teamBatting) continue;
          for (const delivery of over.deliveries ?? []) {
            if (!delivery.batterName.trim()) continue;
            const batter = playerRecord(delivery.batterName);
            const runs = deliveryRunValue(delivery.outcome);
            batter.balls += 1;
            if (runs === 0) { batter.dots += 1; teamRunTypes.dots += 1; }
            else if (runs === 1) { batter.rotations += 1; teamRunTypes.ones += 1; }
            else if (runs === 2) { batter.rotations += 1; teamRunTypes.twos += 1; }
            else if (runs === 3) { batter.rotations += 1; teamRunTypes.threes += 1; }
            else if (runs === 4) teamRunTypes.fours += 1;
            else if (runs === 5) teamRunTypes.fives += 1;
            else if (runs === 6) teamRunTypes.sixes += 1;
            else if ((runs ?? 0) >= 7) teamRunTypes.sevensPlus += 1;
            if (isDismissalOutcome(delivery.outcome)) {
              batter.dismissals += 1;
              teamRunTypes.dismissals += 1;
              const label = dismissalLabel(delivery.outcome);
              dismissalCounts.set(label, (dismissalCounts.get(label) ?? 0) + 1);
            }
          }
        }
      }
    }
  }

  const intelligenceRows = [...playerIntelligence.values()];
  const dotAvoiders = intelligenceRows.filter((player) => player.balls > 0).sort((a, b) => a.dots / a.balls - b.dots / b.balls).slice(0, 5);
  const wicketResilience = intelligenceRows.filter((player) => player.balls > 0).sort((a, b) => (b.dismissals ? b.balls / b.dismissals : b.balls + 1000) - (a.dismissals ? a.balls / a.dismissals : a.balls + 1000)).slice(0, 5);
  const runRotators = intelligenceRows.filter((player) => player.balls > 0).sort((a, b) => b.rotations / b.balls - a.rotations / a.balls).slice(0, 5);
  const wicketPressure = intelligenceRows.filter((player) => player.bowlingBalls > 0).sort((a, b) => b.wickets - a.wickets || b.bowlingDots / b.bowlingBalls - a.bowlingDots / a.bowlingBalls).slice(0, 6);
  const maxScore = Math.max(...recent.flatMap((match) => [match.scored, match.conceded]), 1);
  const wins = recent.filter((match) => match.result === "W").length;
  const losses = recent.filter((match) => match.result === "L").length;
  const draws = recent.length - wins - losses;
  const winPercent = wins / recent.length * 100;
  const lossPercent = losses / recent.length * 100;
  const averageFor = Math.round(recent.reduce((sum, match) => sum + match.scored, 0) / recent.length * 10) / 10;
  const averageAgainst = Math.round(recent.reduce((sum, match) => sum + match.conceded, 0) / recent.length * 10) / 10;
  const seasonScores = analysed.map((match) => match.scored);
  const seasonAverage = seasonScores.reduce((sum, score) => sum + score, 0) / Math.max(1, seasonScores.length);
  const scoreDeviation = Math.sqrt(seasonScores.reduce((sum, score) => sum + (score - seasonAverage) ** 2, 0) / Math.max(1, seasonScores.length));
  const consistencyScore = Math.max(0, Math.round(100 - scoreDeviation / Math.max(1, seasonAverage) * 100));
  const seasonMaxScore = Math.max(...seasonScores, 1);
  const dismissalPalette = ["#ff4d0a", "#211515", "#8f6b5e", "#d38a6e", "#ffb69b", "#a99d96"];
  const dismissalEntries = [...dismissalCounts.entries()];
  const dismissalTotal = Math.max(1, dismissalEntries.reduce((sum, [, count]) => sum + count, 0));
  let dismissalStop = 0;
  const dismissalGradient = dismissalEntries.map(([, count], index) => { const start = dismissalStop; dismissalStop += count / dismissalTotal * 100; return `${dismissalPalette[index % dismissalPalette.length]} ${start}% ${dismissalStop}%`; }).join(", ");
  const runTypeEntries = [
    { label: "Dots", value: teamRunTypes.dots, color: "#a8b3c4" }, { label: "1s", value: teamRunTypes.ones, color: "#63748a" }, { label: "2s", value: teamRunTypes.twos, color: "#347ff0" }, { label: "3s", value: teamRunTypes.threes, color: "#5f5bea" }, { label: "4s", value: teamRunTypes.fours, color: "#a248ed" }, { label: "5s", value: teamRunTypes.fives, color: "#e0357a" }, { label: "6s", value: teamRunTypes.sixes, color: "#00b3a4" }, { label: "7s+", value: teamRunTypes.sevensPlus, color: "#d9ef45" }, { label: "Outs", value: teamRunTypes.dismissals, color: "#ff4d0a" },
  ];
  const runTypeTotal = Math.max(1, runTypeEntries.reduce((sum, item) => sum + item.value, 0));
  let runTypeStop = 0;
  const runTypeGradient = runTypeEntries.map((item) => { const start = runTypeStop; runTypeStop += item.value / runTypeTotal * 100; return `${item.color} ${start}% ${runTypeStop}%`; }).join(", ");
  const splitStats = (battingFirst: boolean) => {
    const splitMatches = analysed.filter((match) => ((match.innings?.[0]?.battingTeam ?? "").toLowerCase() === teamName.toLowerCase()) === battingFirst);
    return { games: splitMatches.length, wins: splitMatches.filter((match) => match.result === "W").length, average: splitMatches.length ? Math.round(splitMatches.reduce((sum, match) => sum + match.scored, 0) / splitMatches.length * 10) / 10 : 0 };
  };
  const first = splitStats(true);
  const second = splitStats(false);
  const rankRows = (rows: TeamPlayerIntelligence[], value: (player: TeamPlayerIntelligence) => string, width: (player: TeamPlayerIntelligence) => number) => rows.length ? rows.map((player, index) => <div className="intelligence-rank-row" key={`${playerKey(player.name)}-${index}`}><b>{index + 1}</b><Initials name={player.name} /><span><strong>{player.name}</strong><i><em style={{ width: `${Math.max(4, Math.min(100, width(player)))}%` }} /></i></span><em>{value(player)}</em></div>) : <div className="panel-empty">Ball-by-ball data is needed for this ranking.</div>;

  return <div className="team-intelligence-suite">
    <section className="analytics-panel team-analytics">
      <div className="section-title"><div><p className="overline">TEAM PERFORMANCE</p><h2>Form from uploaded scorecards</h2></div><span>Last {recent.length} matches</span></div>
      <div className="analytics-kpis"><article><span>WIN RATE</span><strong>{Math.round(winPercent)}%</strong><small>{wins} wins from {recent.length}</small></article><article><span>AVG SCORED</span><strong>{averageFor}</strong><small>per uploaded game</small></article><article><span>AVG CONCEDED</span><strong>{averageAgainst}</strong><small>{averageFor >= averageAgainst ? "+" : ""}{Math.round((averageFor - averageAgainst) * 10) / 10} margin</small></article></div>
      <div className="analytics-chart-grid">
        <article className="chart-card score-chart-card"><header><div><span>SCORE TREND</span><strong>For vs against</strong></div><div className="chart-legend"><i className="legend-for" />Scored<i className="legend-against" />Conceded</div></header><div className="score-trend-chart" role="img" aria-label={`${teamName} scores for and against across the last ${recent.length} uploaded matches`}>{recent.map((match) => <div className="score-chart-column" key={match.id} title={`${teamName} ${match.scored}–${match.conceded} ${match.opponent}`}><div className="score-column-values"><b>{match.scored}</b><small>{match.conceded}</small></div><div className="score-column-bars"><i className="bar-for" style={{ height: `${Math.max(4, match.scored / maxScore * 100)}%` }} /><i className="bar-against" style={{ height: `${Math.max(4, match.conceded / maxScore * 100)}%` }} /></div><span className={`result-chip result-${match.result.toLowerCase()}`}>{match.result}</span><em>#{match.fixtureId}</em></div>)}</div></article>
        <article className="chart-card result-chart-card"><header><div><span>RESULT MIX</span><strong>{wins}W · {losses}L · {draws}D</strong></div></header><div className="result-donut" role="img" aria-label={`${wins} wins, ${losses} losses and ${draws} draws`} style={{ background: `conic-gradient(var(--green) 0 ${winPercent}%, var(--orange) ${winPercent}% ${winPercent + lossPercent}%, #9ba8a4 ${winPercent + lossPercent}% 100%)` }}><span><strong>{Math.round(winPercent)}%</strong><small>WIN RATE</small></span></div><div className="result-legend"><span><i className="win" />Wins <b>{wins}</b></span><span><i className="loss" />Losses <b>{losses}</b></span><span><i className="draw" />Draws <b>{draws}</b></span></div><div className="skins-strip"><span>SKINS WON</span>{recent.map((match) => <i key={match.id} title={`Fixture ${match.fixtureId}: ${match.skins} skins`}><em style={{ width: `${Math.max(4, match.skins / 4 * 100)}%` }} /></i>)}</div></article>
      </div>
    </section>

    <section className="team-ranking-section"><div className="section-title"><div><p className="overline">BATTING INTELLIGENCE</p><h2>Who controls the innings?</h2></div><span>Calculated from every recorded delivery</span></div><div className="team-ranking-grid">
      <article><header><span>01</span><div><strong>Dot Ball Avoiders</strong><small>Lowest percentage of dot balls faced</small></div></header>{rankRows(dotAvoiders, (player) => `${Math.round(player.dots / player.balls * 100)}% dots`, (player) => 100 - player.dots / player.balls * 100)}</article>
      <article><header><span>02</span><div><strong>Wicket Resilience</strong><small>Most deliveries faced per dismissal</small></div></header>{rankRows(wicketResilience, (player) => player.dismissals ? `${Math.round(player.balls / player.dismissals * 10) / 10} balls/out` : `Not out · ${player.balls} balls`, (player) => player.dismissals ? Math.min(100, player.balls / player.dismissals * 5) : 100)}</article>
      <article><header><span>03</span><div><strong>Run Rotators</strong><small>Highest percentage of 1–3 run outcomes</small></div></header>{rankRows(runRotators, (player) => `${Math.round(player.rotations / player.balls * 100)}% rotation`, (player) => player.rotations / player.balls * 100)}</article>
    </div>
    </section>

    <section className="team-pattern-grid">
      <article className="consistency-card"><header><div><p>TEAM SCORING CONSISTENCY</p><h2>{consistencyScore}% repeatability</h2><span>Average {Math.round(seasonAverage * 10) / 10} · deviation {Math.round(scoreDeviation * 10) / 10}</span></div><strong>{analysed.length}<small>GAMES</small></strong></header><div className="consistency-chart" role="img" aria-label={`${teamName} scoring consistency across ${analysed.length} matches`}>{analysed.map((match) => <i key={match.id} title={`Fixture ${match.fixtureId}: ${match.scored} scored`}><b>{match.scored}</b><em style={{ height: `${Math.max(5, match.scored / seasonMaxScore * 100)}%` }} /></i>)}</div></article>
      <article className="run-type-card"><header><div><p>TEAM RUN TYPES</p><h2>How the runs are built</h2></div><span>{runTypeTotal} outcomes</span></header><div><div className="team-run-donut" role="img" aria-label={`${teamName} run type distribution`} style={{ background: `conic-gradient(${runTypeGradient})` }}><span><strong>{Math.round((teamRunTypes.ones + teamRunTypes.twos + teamRunTypes.threes) / runTypeTotal * 100)}%</strong><small>ROTATION</small></span></div><div className="team-run-legend">{runTypeEntries.map((item) => <span key={item.label}><i style={{ background: item.color }} /><b>{item.label}</b><strong>{item.value}</strong><small>{Math.round(item.value / runTypeTotal * 100)}%</small></span>)}</div></div></article>
      <article className="wicket-pressure-card"><header><div><p>TEAM WICKET PRESSURE ANALYSIS</p><h2>Who creates the threat?</h2></div><span>Wickets and dot-ball pressure</span></header><div className="pressure-rank-list">{wicketPressure.length ? wicketPressure.map((player, index) => <div key={`${playerKey(player.name)}-${index}`}><b>{index + 1}</b><Initials name={player.name} /><span><strong>{player.name}</strong><small>{Math.round(player.bowlingDots / player.bowlingBalls * 100)}% dot balls · {player.extras} extras</small></span><em>{player.wickets}<small>WKTS</small></em></div>) : <div className="panel-empty">Bowling deliveries will appear after the next detailed scorecard import.</div>}</div></article>
      <article className="wicket-risk-card"><header><div><p>TEAM WICKET RISK PATTERN</p><h2>How dismissals happen</h2></div><span>{dismissalEntries.reduce((sum, [, count]) => sum + count, 0)} dismissals</span></header><div><div className="wicket-risk-donut" role="img" aria-label={`${teamName} dismissal pattern`} style={{ background: `conic-gradient(${dismissalGradient || "#eee7df 0 100%"})` }}><span><strong>{dismissalEntries.reduce((sum, [, count]) => sum + count, 0)}</strong><small>OUTS</small></span></div><div className="wicket-risk-legend">{dismissalEntries.length ? dismissalEntries.map(([label, count], index) => <span key={label}><i style={{ background: dismissalPalette[index % dismissalPalette.length] }} /><b>{label}</b><strong>{count}</strong></span>) : <small>No dismissal events recorded.</small>}</div></div></article>
      <article className="innings-split-card"><header><div><p>INNINGS SPLITS</p><h2>Batting first vs bowling first</h2></div><span>{analysed.length} analyzed games</span></header><div><section><span>BATTING FIRST</span><strong>{first.average}</strong><small>average score · {first.wins}/{first.games} wins</small></section><section><span>BOWLING FIRST</span><strong>{second.average}</strong><small>average score · {second.wins}/{second.games} wins</small></section></div></article>
    </section>
  </div>;
}

function playerKey(value: string) {
  return value.replace(/^\s*\d+\s*/, "").replace(/\bunknown\b/gi, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function PlayerPerformanceCharts({ player, activities, seasonFilter, onSeasonFilterChange, seasonNames, nameHeading = "h1" }: { player: PlayerProfile; activities: MatchActivity[]; seasonFilter: string; onSeasonFilterChange: (seasonId: string) => void; seasonNames: Record<number, string>; nameHeading?: "h1" | "h2" }) {
  const [matchWindow, setMatchWindow] = useState<5 | 10 | 99>(10);
  const [formMetric, setFormMetric] = useState<"runs" | "wickets" | "impact">("impact");
  const [activeSlice, setActiveSlice] = useState("dots");
  const [activeFixture, setActiveFixture] = useState<string | null>(null);
  const seasonOptions = [...new Map(player.seasons.map((item) => [item.teamSeasonId, item])).values()];
  const activeSeasonFilter = seasonFilter === "all" || seasonOptions.some((item) => String(item.teamSeasonId) === seasonFilter) ? seasonFilter : "all";
  const selectedSeason = seasonOptions.find((item) => String(item.teamSeasonId) === activeSeasonFilter);
  const selectedSeasonName = selectedSeason ? seasonNames[selectedSeason.teamSeasonId] ?? `Season ${selectedSeason.seasonId}` : "All time";
  const performanceScopeLabel = selectedSeasonName;
  const seasonFilteredMatches = activeSeasonFilter === "all" ? player.matches : player.matches.filter((match) => String(match.teamSeasonId) === activeSeasonFilter);
  const linked = seasonFilteredMatches.slice(0, matchWindow === 99 ? seasonFilteredMatches.length : matchWindow).reverse();
  const detailsForMatches = (matches: PlayerMatch[]) => {
    const links = new Map(matches.map((match) => [match.fixtureId, match]));
    const detailedMatches = activities.filter((match) => links.has(match.fixtureId));
    const rows = detailedMatches.flatMap((match) => {
      const link = links.get(match.fixtureId);
      if (!link) return [];
      const names = new Set([playerKey(player.displayName), playerKey(link.playerName)]);
      return (match.performances ?? []).filter((row) => names.has(playerKey(row.playerName)) && row.teamName.toLowerCase() === link.teamName.toLowerCase());
    });
    const batting = detailedMatches.flatMap((match) => {
      const link = links.get(match.fixtureId);
      const names = new Set([playerKey(player.displayName), playerKey(link?.playerName ?? "")]);
      return (match.innings ?? []).flatMap((innings) => (innings.pairs ?? []).flatMap((pair) => (pair.overs ?? []).flatMap((over) => (over.deliveries ?? []).filter((delivery) => names.has(playerKey(delivery.batterName))))));
    });
    const bowling = detailedMatches.flatMap((match) => {
      const link = links.get(match.fixtureId);
      const names = new Set([playerKey(player.displayName), playerKey(link?.playerName ?? "")]);
      return (match.innings ?? []).flatMap((innings) => (innings.pairs ?? []).flatMap((pair) => (pair.overs ?? []).filter((over) => names.has(playerKey(over.bowlerName)))));
    });
    return { rows, batting, bowling };
  };
  const selectedDetails = detailsForMatches(linked);
  const summaryDetails = detailsForMatches(seasonFilteredMatches);
  const detailRows = selectedDetails.rows;
  const battingDeliveries = selectedDetails.batting;
  const bowlingOvers = selectedDetails.bowling;
  const isDismissal = isDismissalOutcome;
  const numericOutcome = deliveryRunValue;
  const summaryGames = activeSeasonFilter === "all" ? player.allTime.games : seasonFilteredMatches.length;
  const summaryRuns = activeSeasonFilter === "all" ? player.allTime.runs : seasonFilteredMatches.reduce((sum, match) => sum + match.runs, 0);
  const summaryWickets = activeSeasonFilter === "all" ? player.allTime.wickets : seasonFilteredMatches.reduce((sum, match) => sum + match.wickets, 0);
  const summaryContribution = activeSeasonFilter === "all" ? player.allTime.contribution : seasonFilteredMatches.reduce((sum, match) => sum + match.contribution, 0);
  const summaryStrikeRate = activeSeasonFilter === "all" ? player.allTime.strikeRate : summaryGames ? Math.round(seasonFilteredMatches.reduce((sum, match) => sum + match.strikeRate, 0) / summaryGames * 10) / 10 : 0;
  const summaryRunsAverage = summaryGames ? Math.round(summaryRuns / summaryGames * 10) / 10 : 0;
  const summaryContributionAverage = summaryGames ? Math.round(summaryContribution / summaryGames * 10) / 10 : 0;
  const summaryDismissals = summaryDetails.batting.filter((ball) => isDismissal(ball.outcome)).length;
  const summaryOvers = Math.round(summaryDetails.rows.reduce((sum, row) => sum + row.oversBowled, 0) * 10) / 10;
  const summaryRunsConceded = summaryDetails.rows.reduce((sum, row) => sum + row.runsConceded, 0);
  const summaryEconomy = summaryOvers ? Math.round(summaryRunsConceded / summaryOvers * 10) / 10 : 0;
  const summaryBattingBalls = summaryDetails.batting.length;
  const summaryDotBalls = summaryDetails.batting.filter((delivery) => deliveryRunValue(delivery.outcome) === 0).length;
  const summaryRotationBalls = summaryDetails.batting.filter((delivery) => { const value = deliveryRunValue(delivery.outcome); return value !== null && value >= 1 && value <= 3; }).length;
  const summaryBoundaryBalls = summaryDetails.batting.filter((delivery) => (deliveryRunValue(delivery.outcome) ?? 0) >= 4).length;
  const summaryDotAvoidance = summaryBattingBalls ? Math.round((1 - summaryDotBalls / summaryBattingBalls) * 100) : 0;
  const summaryRotationRate = summaryBattingBalls ? Math.round(summaryRotationBalls / summaryBattingBalls * 100) : 0;
  const summaryBallsPerDismissal = summaryDismissals ? Math.round(summaryBattingBalls / summaryDismissals * 10) / 10 : summaryBattingBalls;
  const summaryDismissalEntries = ["Caught", "Bowled", "Run out", "Stumped", "Mankad", "Hit wicket", "LBW", "Interference / obstruction"].map((label) => ({ label, count: summaryDetails.batting.filter((delivery) => dismissalLabel(delivery.outcome) === label && isDismissalOutcome(delivery.outcome)).length })).filter((item) => item.count > 0);
  const summaryBowlingDeliveries = summaryDetails.bowling.flatMap((over) => over.deliveries ?? []);
  const summaryBowlingDots = summaryBowlingDeliveries.filter((delivery) => deliveryRunValue(delivery.outcome) === 0).length;
  const summaryBowlingDotRate = summaryBowlingDeliveries.length ? Math.round(summaryBowlingDots / summaryBowlingDeliveries.length * 100) : 0;
  const summaryWides = summaryBowlingDeliveries.filter((delivery) => isWideOutcome(delivery.outcome)).length;
  const summaryNoBalls = summaryBowlingDeliveries.filter((delivery) => isNoBallOutcome(delivery.outcome)).length;
  const summaryBowlingAverage = summaryWickets ? Math.round(summaryRunsConceded / summaryWickets * 10) / 10 : 0;
  const concededDistribution = [0, 1, 2, 3, 4].map((value) => ({ label: value === 4 ? "4+" : String(value), count: summaryBowlingDeliveries.filter((delivery) => value === 4 ? (deliveryRunValue(delivery.outcome) ?? 0) >= 4 : deliveryRunValue(delivery.outcome) === value).length }));
  const scoring = [
    { id: "dots", label: "Dot balls", short: "0", color: "#e8dfcf", count: battingDeliveries.filter((ball) => numericOutcome(ball.outcome) === 0).length },
    { id: "ones", label: "Singles", short: "1", color: "#d7c9ad", count: battingDeliveries.filter((ball) => numericOutcome(ball.outcome) === 1).length },
    { id: "twos", label: "Twos", short: "2", color: "#bfae8d", count: battingDeliveries.filter((ball) => numericOutcome(ball.outcome) === 2).length },
    { id: "threes", label: "Threes", short: "3", color: "#8c7d64", count: battingDeliveries.filter((ball) => numericOutcome(ball.outcome) === 3).length },
    { id: "boundaries", label: "Boundaries", short: "4+", color: "#ff4d0a", count: battingDeliveries.filter((ball) => (numericOutcome(ball.outcome) ?? 0) >= 4).length },
    { id: "extras", label: "Extra-assisted", short: "EX", color: "#ffb69b", count: battingDeliveries.filter((ball) => isExtraOutcome(ball.outcome)).length },
    { id: "outs", label: "Dismissals", short: "OUT", color: "#211313", count: battingDeliveries.filter((ball) => isDismissal(ball.outcome)).length },
  ];
  const totalOutcomes = Math.max(1, scoring.reduce((sum, item) => sum + item.count, 0));
  let donutStop = 0;
  const donutGradient = scoring.map((item) => { const start = donutStop; donutStop += item.count / totalOutcomes * 100; return `${item.color} ${start}% ${donutStop}%`; }).join(", ");
  const selectedSlice = scoring.find((item) => item.id === activeSlice) ?? scoring[0];
  const totalOvers = Math.round(detailRows.reduce((sum, row) => sum + row.oversBowled, 0) * 10) / 10;
  const conceded = detailRows.reduce((sum, row) => sum + row.runsConceded, 0);
  const wickets = detailRows.reduce((sum, row) => sum + row.wickets, 0) || linked.reduce((sum, match) => sum + match.wickets, 0);
  const economy = totalOvers ? Math.round(conceded / totalOvers * 10) / 10 : 0;
  const dotBallsBowled = bowlingOvers.flatMap((over) => over.deliveries ?? []).filter((delivery) => numericOutcome(delivery.outcome) === 0).length;
  const bowlingExtras = bowlingOvers.flatMap((over) => over.deliveries ?? []).filter((delivery) => isExtraOutcome(delivery.outcome)).length;
  const games = Math.max(1, linked.length);
  const runs = linked.reduce((sum, match) => sum + match.runs, 0);
  const contribution = linked.reduce((sum, match) => sum + match.contribution, 0);
  const averageRuns = Math.round(runs / games * 10) / 10;
  const averageWickets = Math.round(wickets / games * 100) / 100;
  const averageImpact = Math.round(contribution / games * 10) / 10;
  const bestImpact = linked.length ? Math.max(...linked.map((match) => match.contribution)) : 0;
  const positiveMatches = linked.filter((match) => match.contribution >= 0).length;
  const consistency = Math.round(positiveMatches / games * 100);
  const boundaryRate = Math.round((scoring.find((item) => item.id === "boundaries")?.count ?? 0) / totalOutcomes * 100);
  const battingScore = Math.min(100, Math.round(averageRuns / 24 * 100));
  const bowlingScore = Math.min(100, Math.round(averageWickets / 3 * 100));
  const impactScore = Math.min(100, Math.max(0, Math.round((averageImpact + 12) / 36 * 100)));
  const metricValue = (match: PlayerMatch) => formMetric === "runs" ? match.runs : formMetric === "wickets" ? match.wickets : match.contribution;
  const maxMetric = Math.max(...linked.map((match) => Math.abs(metricValue(match))), 1);
  const activeMatch = linked.find((match) => match.fixtureId === activeFixture) ?? linked[linked.length - 1];
  const jersey = player.displayName.match(/^\s*(\d+)/)?.[1] ?? "DB";
  const displayName = player.displayName.replace(/^\s*\d+\s*/, "") || player.displayName;
  const teamName = player.seasons[0]?.teamName ?? "Action Cricket";
  const PlayerNameHeading = nameHeading;

  return <div className="smart-player-suite">
    <section className="smart-athlete-hero fifa-card">
      <div className="smart-athlete-portrait">{player.imageUrl ? <img src={player.imageUrl} alt={player.displayName} /> : <span className="smart-athlete-portrait-fallback">{displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("")}</span>}<b className="smart-athlete-jersey">{jersey}</b></div>
      <div className="smart-athlete-id"><small>{player.role || "All-rounder"}</small><PlayerNameHeading>{displayName}</PlayerNameHeading><em>{teamName}</em>
        <div className="hero-stat-grid"><article><strong>{player.allTime.games}</strong><span>Games</span></article><article className="hot"><strong>{player.allTime.runs}</strong><span>Runs</span></article><article><strong>{player.allTime.wickets}</strong><span>Wickets</span></article><article className="hot"><strong>{player.allTime.contribution > 0 ? "+" : ""}{player.allTime.contribution}</strong><span>Impact</span></article></div>
      </div>
      <div className="smart-athlete-fingerprint"><div className="fingerprint-rings"><i className="ring-batting" style={{ background: `conic-gradient(#ff4d0a ${battingScore}%, #3b302e ${battingScore}% 100%)` }}><i className="ring-bowling" style={{ "--ring": `conic-gradient(#d9ef45 ${bowlingScore}%, #403a33 ${bowlingScore}% 100%)` } as CSSProperties}><i className="ring-impact" style={{ "--ring": `conic-gradient(#ffffff ${impactScore}%, #514a45 ${impactScore}% 100%)` } as CSSProperties}><span><strong>{Math.round((battingScore + bowlingScore + impactScore) / 3)}</strong><small>PROFILE</small></span></i></i></i></div><div className="fingerprint-legend"><span><i />Batting <b>{battingScore}</b></span><span><i />Bowling <b>{bowlingScore}</b></span><span><i />Impact <b>{impactScore}</b></span></div></div>
    </section>

    <section className="career-stat-section"><div className="smart-section-heading"><div><p>{selectedSeason ? `${selectedSeasonName.toUpperCase()} STATISTICS` : "ALL-TIME STATISTICS"}</p><h2>The complete player</h2></div><div className="career-filter-controls"><span>{seasonFilteredMatches.length} verified scorecard{seasonFilteredMatches.length === 1 ? "" : "s"}</span><label className="performance-season-filter"><span>Choose season</span><select aria-label="Choose performance season" value={activeSeasonFilter} onChange={(event) => { onSeasonFilterChange(event.target.value); setActiveFixture(null); }}><option value="all">All-time career</option>{seasonOptions.map((item) => <option key={item.teamSeasonId} value={String(item.teamSeasonId)}>{seasonNames[item.teamSeasonId] ?? `Season ${item.seasonId}`}</option>)}</select></label></div></div><div className="career-stat-grid">{[
      ["G", summaryGames, "Games"], ["R", summaryRuns, "Runs"], ["RA", summaryRunsAverage, "Runs average"], ["SR", summaryStrikeRate, "Strike rate"], ["TO", summaryDismissals, "Times out"], ["OB", summaryOvers, "Overs bowled"],
      ["W", summaryWickets, "Wickets"], ["WA", summaryGames ? Math.round(summaryWickets / summaryGames * 100) / 100 : 0, "Wickets average"], ["RC", summaryRunsConceded, "Runs conceded"], ["RCA", summaryGames ? Math.round(summaryRunsConceded / summaryGames * 10) / 10 : 0, "Runs conceded average"], ["C", `${summaryContribution > 0 ? "+" : ""}${summaryContribution}`, "Contribution"], ["CA", summaryContributionAverage, "Contribution average"],
    ].map(([code, value, label]) => <article key={String(code)}><span>{code}</span><strong>{value}</strong><small>{label}</small></article>)}</div></section>

    <section className="analytics-control-bar"><div><p>PERFORMANCE INTELLIGENCE</p><strong>Explore the player’s game</strong><span>{performanceScopeLabel} · {seasonFilteredMatches.length} scorecard{seasonFilteredMatches.length === 1 ? "" : "s"}</span></div><div className="range-switch" aria-label="Match range">{([[5, "Last 5"], [10, "Last 10"], [99, "All matches"]] as const).map(([value, label]) => <button key={value} aria-pressed={matchWindow === value} onClick={() => setMatchWindow(value)}>{label}</button>)}</div></section>

    {!linked.length ? <section className="smart-empty"><strong>{selectedSeason ? `No scorecards in ${selectedSeasonName} yet.` : "Upload a completed scorecard to unlock the intelligence layer."}</strong><span>{selectedSeason ? "The player stays on the season roster, but statistics remain at zero until that season’s scorecards are imported." : "The hero and career record are ready; ball-by-ball charts appear after the first linked match."}</span></section> : <>

      <div className="smart-chart-grid">
        <section className="scoring-dna-card"><div className="smart-card-heading"><div><p>SCORING DNA</p><h2>How they score</h2><span>{battingDeliveries.length} recorded deliveries · {runs} runs</span></div><em>Tap a segment</em></div><div className="scoring-dna-layout"><button className="score-donut" aria-label={`${player.displayName} scoring distribution`} style={{ background: `conic-gradient(${donutGradient || "#e8dfcf 0 100%"})` }}><span><strong>{selectedSlice.count}</strong><small>{selectedSlice.label}</small><b>{Math.round(selectedSlice.count / totalOutcomes * 100)}%</b></span></button><div className="score-legend">{scoring.map((item) => <button key={item.id} className={activeSlice === item.id ? "active" : ""} aria-pressed={activeSlice === item.id} onClick={() => setActiveSlice(item.id)}><i style={{ background: item.color }} /><span><b>{item.label}</b><small>{item.short}</small></span><strong>{item.count}</strong><em>{Math.round(item.count / totalOutcomes * 100)}%</em></button>)}</div></div><p className="chart-explainer">Built directly from the uploaded ball sequence. Select any outcome to isolate its share of this player’s scoring pattern.</p></section>

        <section className="bowling-control-card"><div className="smart-card-heading"><div><p>BOWLING CONTROL</p><h2>Threat & pressure</h2><span>{totalOvers} overs · {wickets} wickets · {conceded} conceded</span></div><em>{economy || "—"} econ</em></div><div className="bowling-metric-grid"><article><strong>{totalOvers}</strong><span>Overs</span></article><article><strong>{wickets}</strong><span>Wickets</span></article><article><strong>{conceded}</strong><span>Runs conceded</span></article><article><strong>{economy}</strong><span>Economy</span></article><article><strong>{dotBallsBowled}</strong><span>Dot balls</span></article><article><strong>{bowlingExtras}</strong><span>Extras</span></article></div><div className="pressure-meter"><span><b>Pressure balls</b><small>dots across recorded bowling deliveries</small></span><strong>{dotBallsBowled}</strong><i><em style={{ width: `${Math.min(100, dotBallsBowled / Math.max(1, bowlingOvers.length * 6) * 100)}%` }} /></i></div></section>
      </div>

      <div className="player-deep-dive-grid">
        <section className="player-depth-card batting-depth-card"><header><div><p>BATTING PROFILE</p><h2>Efficiency &amp; wicket resilience</h2><span>{performanceScopeLabel} · every recorded batting delivery</span></div><strong>{summaryDotAvoidance}%<small>DOT AVOIDANCE</small></strong></header><div className="player-depth-metrics"><article><span>Balls faced</span><strong>{summaryBattingBalls}</strong></article><article><span>Runs / match</span><strong>{summaryRunsAverage}</strong></article><article><span>Balls / dismissal</span><strong>{summaryBallsPerDismissal}</strong></article><article><span>Run rotation</span><strong>{summaryRotationRate}%</strong></article><article><span>Boundaries</span><strong>{summaryBoundaryBalls}</strong></article><article><span>Dismissals</span><strong>{summaryDismissals}</strong></article></div><div className="dismissal-breakdown"><span>DISMISSAL PATTERN</span><div>{summaryDismissalEntries.length ? summaryDismissalEntries.map((item) => <article key={item.label}><b>{item.label}</b><strong>{item.count}</strong><i><em style={{ width: `${item.count / Math.max(1, summaryDismissals) * 100}%` }} /></i></article>) : <small>No dismissals recorded in this view.</small>}</div></div></section>
        <section className="player-depth-card bowling-depth-card"><header><div><p>BOWLING PROFILE</p><h2>Discipline &amp; conceded runs</h2><span>{performanceScopeLabel} · every recorded bowling delivery</span></div><strong>{summaryBowlingDotRate}%<small>DOT PRESSURE</small></strong></header><div className="player-depth-metrics"><article><span>Deliveries</span><strong>{summaryBowlingDeliveries.length}</strong></article><article><span>Runs / wicket</span><strong>{summaryBowlingAverage || "—"}</strong></article><article><span>Economy</span><strong>{summaryEconomy || "—"}</strong></article><article><span>Dot balls</span><strong>{summaryBowlingDots}</strong></article><article><span>Wides</span><strong>{summaryWides}</strong></article><article><span>No balls</span><strong>{summaryNoBalls}</strong></article></div><div className="conceded-distribution"><span>RUNS CONCEDED BY DELIVERY</span><div>{concededDistribution.map((item) => <article key={item.label}><b>{item.label}</b><strong>{item.count}</strong><small>{summaryBowlingDeliveries.length ? Math.round(item.count / summaryBowlingDeliveries.length * 100) : 0}%</small></article>)}</div></div></section>
      </div>

      <section className="form-lab-card"><div className="smart-card-heading"><div><p>FORM LAB</p><h2>Match momentum</h2><span>Choose a metric, then tap any match for its exact scorecard values.</span></div><div className="metric-switch">{(["runs", "wickets", "impact"] as const).map((metric) => <button key={metric} aria-pressed={formMetric === metric} onClick={() => setFormMetric(metric)}>{metric}</button>)}</div></div><div className="mobile-scroll-hint">Swipe to explore every match →</div><div className="form-chart" role="img" aria-label={`${player.displayName} ${formMetric} across ${linked.length} matches`}>{linked.map((match) => { const value = metricValue(match); return <button key={match.claimId} className={`${activeMatch?.fixtureId === match.fixtureId ? "active" : ""} ${value < 0 ? "negative" : ""}`} onClick={() => setActiveFixture(match.fixtureId)} title={`${match.homeTeam} ${match.homeScore}–${match.awayScore} ${match.awayTeam}: ${match.runs} runs, ${match.wickets} wickets, ${match.contribution} impact`}><span>{value}</span><i><em style={{ height: `${Math.max(8, Math.abs(value) / maxMetric * 100)}%` }} /></i></button>; })}</div>{activeMatch && <div className="active-match-readout"><span><b>{activeMatch.homeTeam} {activeMatch.homeScore}–{activeMatch.awayScore} {activeMatch.awayTeam}</b><small>{activeMatch.playedAt}</small></span><strong>{activeMatch.runs}<small>RUNS</small></strong><strong>{activeMatch.wickets}<small>WKTS</small></strong><strong className={activeMatch.contribution < 0 ? "negative" : ""}>{activeMatch.contribution}<small>IMPACT</small></strong></div>}</section>

      <section className="smart-insights"><div><p>SMART READ</p><h2>What the data says</h2></div><article><span>01</span><div><strong>{boundaryRate >= 15 ? "Boundary accelerator" : "Rotation builder"}</strong><p>{boundaryRate}% of recorded outcomes are boundaries. {boundaryRate >= 15 ? "The scoring profile creates momentum quickly." : "The value comes from accumulating and protecting the pair."}</p></div></article><article><span>02</span><div><strong>{averageWickets >= 1.5 ? "Genuine wicket threat" : "Control-first bowler"}</strong><p>{averageWickets} wickets per match with an economy of {economy || "—"} across the selected window.</p></div></article><article><span>03</span><div><strong>{consistency}% positive-impact consistency</strong><p>{positiveMatches} of the last {linked.length} performances finished at zero impact or better. Peak impact: {bestImpact}.</p></div></article></section>
    </>}
  </div>;
}

function deliveryTone(outcome: string) {
  const code = scorecardCode(outcome);
  if (isDismissalOutcome(outcome)) return "wicket";
  if (isExtraOutcome(outcome)) return "extra";
  if (Number(code) >= 4) return "boundary";
  if (!code || code === "0") return "dot";
  return "run";
}

export default function Home() {
  const [view, setView] = useState<View>("feed");
  const [teams, setTeams] = useState<Team[]>([]);
  const [activities, setActivities] = useState<MatchActivity[]>([]);
  const [profiles, setProfiles] = useState<PlayerProfile[]>([]);
  const [directoryProfiles, setDirectoryProfiles] = useState<PlayerProfile[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [viewedProfileId, setViewedProfileId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [teamUrl, setTeamUrl] = useState("");
  const [newSeasonName, setNewSeasonName] = useState("");
  const [newSeasonLeague, setNewSeasonLeague] = useState("");
  const [newSeasonExternalId, setNewSeasonExternalId] = useState("");
  const [scorecardFiles, setScorecardFiles] = useState<File[]>([]);
  const [scorecardMatchType, setScorecardMatchType] = useState<MatchType>("league");
  const [scorecardImportFeedback, setScorecardImportFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [scorecardSeasonId, setScorecardSeasonId] = useState<number | null>(null);
  const [rankingMetric, setRankingMetric] = useState<RankingMetric>("impact");
  const [rankingSearch, setRankingSearch] = useState("");
  const [rankingParticipationFilter, setRankingParticipationFilter] = useState<RankingParticipationFilter>("all");
  const [rankingTableSort, setRankingTableSort] = useState<RankingTableSort>("impact");
  const [rankingSortDirection, setRankingSortDirection] = useState<RankingSortDirection>("desc");
  const [playerSeasonFilter, setPlayerSeasonFilter] = useState("all");
  const [playerDirectorySeasonFilter, setPlayerDirectorySeasonFilter] = useState("all");
  const [playerDirectorySort, setPlayerDirectorySort] = useState<PlayerDirectorySort>("name");
  const [teamStatsMatchFilter, setTeamStatsMatchFilter] = useState<TeamStatsMatchFilter>("all");
  const [teamStatsResultFilter, setTeamStatsResultFilter] = useState<TeamStatsResultFilter>("all");
  const [teamStatsSort, setTeamStatsSort] = useState<TeamStatsSort>("oldest");
  const [teamStatsAllTime, setTeamStatsAllTime] = useState(false);
  const [rankingAllTime, setRankingAllTime] = useState(false);
  const [consistencySort, setConsistencySort] = useState<"overall" | "batting" | "bowling" | "games">("overall");
  const [fillerFixtureId, setFillerFixtureId] = useState("2336793");
  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPhone, setAccountPhone] = useState("");
  const [accountBio, setAccountBio] = useState("");
  const [accountRole, setAccountRole] = useState("All-rounder");
  const [accountVenue, setAccountVenue] = useState("");
  const [accountImage, setAccountImage] = useState<string | null>(null);
  const [scorecardCandidates, setScorecardCandidates] = useState<ScorecardCandidate[]>([]);
  const [working, setWorking] = useState<"season" | "match" | "filler" | "account" | "community" | "remove" | "">("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [scorecardMatchId, setScorecardMatchId] = useState<number | null>(null);
  const [scorecardInningsNumber, setScorecardInningsNumber] = useState(1);
  const team = teams[0] ?? null;
  const canManageTeam = !!team;
  const playerImages = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of [...directoryProfiles, ...profiles]) if (entry.imageUrl) map.set(playerKey(entry.displayName), entry.imageUrl);
    return map;
  }, [profiles, directoryProfiles]);
  const profile = profiles.find((item) => item.id === selectedProfileId) ?? null;
  const viewedProfile = directoryProfiles.find((item) => item.id === viewedProfileId) ?? profiles.find((item) => item.id === viewedProfileId) ?? null;
  const scorecardMatch = activities.find((item) => item.id === scorecardMatchId) ?? null;
  const scorecardInnings = scorecardMatch?.innings?.find((item) => item.inningsNumber === scorecardInningsNumber) ?? scorecardMatch?.innings?.[0] ?? null;
  const currentSeason = team?.seasons?.find((item) => item.isCurrent) ?? team?.seasons?.[0] ?? null;
  const season = team?.seasons?.find((item) => item.id === selectedSeasonId) ?? currentSeason;
  const scorecardImportSeason = team?.seasons?.find((item) => item.id === scorecardSeasonId) ?? currentSeason;

  useEffect(() => {
    Promise.all([
      fetch("/api/teams").then((response) => response.ok ? response.json() : { teams: [] }),
      fetch("/api/scoresheets").then((response) => response.ok ? response.json() : { matches: [] }),
      fetch("/api/players").then((response) => response.ok ? response.json() : { players: [] }),
      fetch("/api/community").then((response) => response.ok ? response.json() : { challenges: [], follows: [] }),
    ]).then(([teamData, matchData, playerData, communityData]) => {
      setTeams(teamData.teams ?? []);
      setActivities(matchData.matches ?? []);
      setProfiles(playerData.players ?? []);
      setDirectoryProfiles(playerData.directory ?? playerData.players ?? []);
      setFollows(communityData.follows ?? []);
      const initialTeam = teamData.teams?.[0];
      const initialSeason = initialTeam?.seasons?.find((item: Season) => item.isCurrent) ?? initialTeam?.seasons?.[0];
      const currentRoster = initialSeason?.players ?? [];
      const rosterProfileIds = new Set<number>(currentRoster.map((item: Player) => item.linkedOwnerId ?? item.playerProfileId).filter(Boolean));
      const firstProfile = playerData.players?.find((item: PlayerProfile) => rosterProfileIds.has(item.id)) as PlayerProfile | undefined;
      setSelectedProfileId(firstProfile?.id ?? null);
      if (firstProfile) { setAccountName(firstProfile.displayName); setAccountEmail(firstProfile.email ?? ""); setAccountPhone(firstProfile.phone ?? ""); setAccountBio(firstProfile.bio ?? ""); setAccountRole(firstProfile.role ?? "All-rounder"); setAccountVenue(firstProfile.preferredVenue ?? ""); setAccountImage(firstProfile.imageUrl ?? null); }
      setSelectedSeasonId(initialSeason?.id ?? null);
      setScorecardSeasonId(initialSeason?.id ?? null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const seasonRosterPlayers = useMemo(() => [...(season?.players ?? team?.players ?? [])], [season, team]);
  const activeRosterPlayers = useMemo(() => seasonRosterPlayers.filter((player) => player.active !== false), [seasonRosterPlayers]);
  const archivedRosterPlayers = useMemo(() => seasonRosterPlayers.filter((player) => player.active === false && (player.linkedAppearances ?? player.games) === 0), [seasonRosterPlayers]);
  const players = useMemo(() => seasonRosterPlayers.filter((player) => player.active !== false || (player.linkedAppearances ?? player.games) > 0).sort((a, b) => b.contribution - a.contribution), [seasonRosterPlayers]);
  const allTimeRankingPlayers = useMemo(() => {
    const groups = new Map<number, { player: Player; strikeRateWeighted: number }>();
    for (const rosterSeason of team?.seasons ?? []) {
      for (const rosterPlayer of rosterSeason.players ?? []) {
        const key = rosterPlayer.linkedOwnerId ?? rosterPlayer.playerProfileId ?? rosterPlayer.id;
        const group = groups.get(key);
        if (!group) {
          groups.set(key, { player: { ...rosterPlayer, id: key }, strikeRateWeighted: rosterPlayer.strikeRate * rosterPlayer.games });
        } else {
          group.player.games += rosterPlayer.games;
          group.player.runs += rosterPlayer.runs;
          group.player.wickets += rosterPlayer.wickets;
          group.player.contribution += rosterPlayer.contribution;
          group.player.linkedAppearances = (group.player.linkedAppearances ?? 0) + (rosterPlayer.linkedAppearances ?? 0);
          group.strikeRateWeighted += rosterPlayer.strikeRate * rosterPlayer.games;
          if ((rosterPlayer.linkedAppearances ?? 0) > 0 && rosterPlayer.registeredAt) group.player.name = rosterPlayer.name;
          if (rosterPlayer.active !== false) group.player.active = true;
        }
      }
    }
    const rows: Player[] = [];
    for (const { player, strikeRateWeighted } of groups.values()) {
      player.runsAverage = player.games ? Math.round(player.runs / player.games * 10) / 10 : 0;
      player.contributionAverage = player.games ? Math.round(player.contribution / player.games * 10) / 10 : 0;
      player.strikeRate = player.games ? Math.round(strikeRateWeighted / player.games * 10) / 10 : 0;
      rows.push(player);
    }
    return rows.filter((player) => player.active !== false || (player.linkedAppearances ?? player.games) > 0).sort((a, b) => b.contribution - a.contribution);
  }, [team]);
  const rankingPlayers = rankingAllTime ? allTimeRankingPlayers : players;
  const rankingTopRuns = useMemo(() => [...rankingPlayers].sort((a, b) => b.runs - a.runs)[0] ?? null, [rankingPlayers]);
  const rankingTopWickets = useMemo(() => [...rankingPlayers].sort((a, b) => b.wickets - a.wickets)[0] ?? null, [rankingPlayers]);
  const topWickets = [...players].sort((a, b) => b.wickets - a.wickets);
  const topRuns = [...players].sort((a, b) => b.runs - a.runs);
  const CONSISTENCY_MIN_GAMES = 5;
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const sampleStdDev = (values: number[], mean: number) => values.length ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) : 0;
  const reliabilityScore = (sd: number, mean: number) => mean > 0 ? Math.max(0, Math.min(100, Math.round(100 - (sd / mean) * 100))) : null;
  const consistencyPlayers = useMemo(() => {
    const rows = directoryProfiles.map((entry) => {
      const matches = entry.matches ?? [];
      if (matches.length < CONSISTENCY_MIN_GAMES) return null;
      const runsSamples = matches.map((item) => item.runs);
      const wicketsSamples = matches.map((item) => item.wickets);
      const runsMean = average(runsSamples);
      const runsSD = sampleStdDev(runsSamples, runsMean);
      const battingConsistency = reliabilityScore(runsSD, runsMean);
      const wicketsMean = average(wicketsSamples);
      const wicketsSD = sampleStdDev(wicketsSamples, wicketsMean);
      const bowlingConsistency = entry.allTime.wickets > 0 ? reliabilityScore(wicketsSD, wicketsMean) : null;
      const components = [battingConsistency, bowlingConsistency].filter((value): value is number => value !== null);
      const overallConsistency = components.length ? Math.round(components.reduce((sum, value) => sum + value, 0) / components.length) : null;
      return {
        id: entry.id, name: entry.displayName, imageUrl: entry.imageUrl, games: matches.length,
        runs: entry.allTime.runs, wickets: entry.allTime.wickets,
        runsMean, runsSD, battingConsistency, wicketsMean, wicketsSD, bowlingConsistency, overallConsistency,
      };
    }).filter((row): row is NonNullable<typeof row> => row !== null && row.overallConsistency !== null);
    return rows;
  }, [directoryProfiles]);
  const mostConsistentBatter = useMemo(() => {
    const contenders = consistencyPlayers.filter((item) => item.battingConsistency !== null);
    if (!contenders.length) return null;
    return [...contenders].sort((a, b) => (b.battingConsistency as number) - (a.battingConsistency as number) || b.games - a.games)[0];
  }, [consistencyPlayers]);
  const mostConsistentBowler = useMemo(() => {
    const contenders = consistencyPlayers.filter((item) => item.bowlingConsistency !== null);
    if (!contenders.length) return null;
    return [...contenders].sort((a, b) => (b.bowlingConsistency as number) - (a.bowlingConsistency as number) || b.games - a.games)[0];
  }, [consistencyPlayers]);
  const sortedConsistencyPlayers = useMemo(() => {
    const rows = [...consistencyPlayers];
    const value = (item: number | null) => item === null ? -1 : item;
    if (consistencySort === "batting") return rows.sort((a, b) => value(b.battingConsistency) - value(a.battingConsistency) || b.games - a.games);
    if (consistencySort === "bowling") return rows.sort((a, b) => value(b.bowlingConsistency) - value(a.bowlingConsistency) || b.games - a.games);
    if (consistencySort === "games") return rows.sort((a, b) => b.games - a.games);
    return rows.sort((a, b) => (b.overallConsistency as number) - (a.overallConsistency as number) || b.games - a.games);
  }, [consistencyPlayers, consistencySort]);
  const followingIds = useMemo(() => new Set(follows.filter((item) => item.followerProfileId === profile?.id).map((item) => item.followingProfileId)), [follows, profile]);
  const searchResults = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return { teams: [], players: [], matches: [] };
    return {
      teams: team?.name.toLowerCase().includes(term) ? [team] : [],
      players: directoryProfiles.filter((item) => item.displayName.toLowerCase().includes(term) && (!team || item.seasons.some((playerSeason) => playerSeason.teamName.toLowerCase() === team.name.toLowerCase() && (playerSeason.active || playerSeason.games > 0)))),
      matches: activities.filter((item) => `${item.homeTeam} ${item.awayTeam} ${item.fixtureId}`.toLowerCase().includes(term)),
    };
  }, [searchQuery, team, directoryProfiles, activities]);
  const teamDirectory = useMemo(() => {
    return directoryProfiles
      .filter((item) => !team || item.seasons.some((playerSeason) => playerSeason.teamName.toLowerCase() === team.name.toLowerCase() && (playerSeason.active || playerSeason.games > 0)))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [directoryProfiles, team]);
  const seasonNames = useMemo(() => Object.fromEntries((team?.seasons ?? []).map((item) => [item.id, item.name || `Season ${item.externalSeasonId}`])), [team]);
  const playerDirectoryRows = useMemo(() => {
    const rows = playerDirectorySeasonFilter === "all"
      ? [...teamDirectory]
      : teamDirectory.filter((item) => item.seasons.some((playerSeason) => String(playerSeason.teamSeasonId) === playerDirectorySeasonFilter && (playerSeason.active || playerSeason.games > 0)));
    const value = (item: PlayerProfile) => {
      if (playerDirectorySeasonFilter === "all") {
        if (playerDirectorySort === "games") return item.allTime.games;
        if (playerDirectorySort === "runs") return item.allTime.runs;
        if (playerDirectorySort === "wickets") return item.allTime.wickets;
        if (playerDirectorySort === "impact") return item.allTime.contribution;
        return 0;
      }
      const playerSeason = item.seasons.find((entry) => String(entry.teamSeasonId) === playerDirectorySeasonFilter);
      if (playerDirectorySort === "games") return playerSeason?.games ?? 0;
      if (playerDirectorySort === "runs") return playerSeason?.runs ?? 0;
      if (playerDirectorySort === "wickets") return playerSeason?.wickets ?? 0;
      if (playerDirectorySort === "impact") return playerSeason?.contribution ?? 0;
      return 0;
    };
    return rows.sort((a, b) => playerDirectorySort === "name" ? a.displayName.localeCompare(b.displayName) : value(b) - value(a) || a.displayName.localeCompare(b.displayName));
  }, [teamDirectory, playerDirectorySeasonFilter, playerDirectorySort]);
  const directoryStatsFor = (item: PlayerProfile) => {
    if (playerDirectorySeasonFilter === "all") return { games: item.allTime.games, runs: item.allTime.runs, wickets: item.allTime.wickets, impact: item.allTime.contribution, scorecards: item.allTime.linkedMatches };
    const playerSeason = item.seasons.find((entry) => String(entry.teamSeasonId) === playerDirectorySeasonFilter);
    return { games: playerSeason?.games ?? 0, runs: playerSeason?.runs ?? 0, wickets: playerSeason?.wickets ?? 0, impact: playerSeason?.contribution ?? 0, scorecards: item.matches.filter((match) => String(match.teamSeasonId) === playerDirectorySeasonFilter).length };
  };
  const matchesForPlayerSeason = (playerProfile: PlayerProfile | null) => {
    if (!playerProfile || playerSeasonFilter === "all" || !playerProfile.seasons.some((item) => String(item.teamSeasonId) === playerSeasonFilter)) return playerProfile?.matches ?? [];
    return playerProfile.matches.filter((match) => String(match.teamSeasonId) === playerSeasonFilter);
  };
  const viewedProfileMatches = matchesForPlayerSeason(viewedProfile);
  const teamActivities = useMemo(() => {
    return activities.filter((match) => !team || match.homeTeam.toLowerCase() === team.name.toLowerCase() || match.awayTeam.toLowerCase() === team.name.toLowerCase());
  }, [activities, team]);
  const seasonActivities = useMemo(() => teamActivities.filter((match) => !season || match.teamSeasonId === season.id || (!match.teamSeasonId && season.id === currentSeason?.id)), [teamActivities, season, currentSeason]);
  const teamStatsActivities = useMemo(() => {
    const timestamp = (match: MatchActivity) => {
      const parsed = Date.parse(match.playedAt);
      return Number.isNaN(parsed) ? match.id : parsed;
    };
    return (teamStatsAllTime ? teamActivities : seasonActivities).filter((match) => {
      if (teamStatsMatchFilter !== "all" && match.matchType !== teamStatsMatchFilter) return false;
      if (teamStatsResultFilter === "all") return true;
      const isHome = match.homeTeam.toLowerCase() === team?.name.toLowerCase();
      const scored = isHome ? match.homeScore : match.awayScore;
      const conceded = isHome ? match.awayScore : match.homeScore;
      const result = scored > conceded ? "win" : scored < conceded ? "loss" : "draw";
      return result === teamStatsResultFilter;
    }).sort((a, b) => teamStatsSort === "oldest" ? timestamp(a) - timestamp(b) : timestamp(b) - timestamp(a));
  }, [seasonActivities, teamActivities, teamStatsAllTime, team, teamStatsMatchFilter, teamStatsResultFilter, teamStatsSort]);
  const seasonTeamSummary = useMemo(() => {
    const totals = { games: seasonActivities.length, wins: 0, losses: 0, draws: 0, scored: 0, conceded: 0 };
    for (const match of seasonActivities) {
      const isHome = match.homeTeam.toLowerCase() === team?.name.toLowerCase();
      const scored = isHome ? match.homeScore : match.awayScore;
      const conceded = isHome ? match.awayScore : match.homeScore;
      totals.scored += scored; totals.conceded += conceded;
      if (scored > conceded) totals.wins += 1;
      else if (scored < conceded) totals.losses += 1;
      else totals.draws += 1;
    }
    return { ...totals, averageScored: totals.games ? Math.round(totals.scored / totals.games * 10) / 10 : 0, averageConceded: totals.games ? Math.round(totals.conceded / totals.games * 10) / 10 : 0 };
  }, [seasonActivities, team]);
  const teamStatsSummary = useMemo(() => {
    const totals = { games: teamStatsActivities.length, wins: 0, losses: 0, draws: 0, scored: 0, conceded: 0 };
    for (const match of teamStatsActivities) {
      const isHome = match.homeTeam.toLowerCase() === team?.name.toLowerCase();
      const scored = isHome ? match.homeScore : match.awayScore;
      const conceded = isHome ? match.awayScore : match.homeScore;
      totals.scored += scored; totals.conceded += conceded;
      if (scored > conceded) totals.wins += 1;
      else if (scored < conceded) totals.losses += 1;
      else totals.draws += 1;
    }
    return { ...totals, averageScored: totals.games ? Math.round(totals.scored / totals.games * 10) / 10 : 0, averageConceded: totals.games ? Math.round(totals.conceded / totals.games * 10) / 10 : 0 };
  }, [teamStatsActivities, team]);
  const teamStatsForm = teamStatsActivities.slice(teamStatsSort === "newest" ? 0 : -5, teamStatsSort === "newest" ? 5 : undefined).map((match) => {
    const isHome = match.homeTeam.toLowerCase() === team?.name.toLowerCase();
    const scored = isHome ? match.homeScore : match.awayScore;
    const conceded = isHome ? match.awayScore : match.homeScore;
    return scored > conceded ? "W" : scored < conceded ? "L" : "D";
  });
  const teamStatsRunDifference = teamStatsSummary.scored - teamStatsSummary.conceded;
  const activeRankingMetric = rankingMetricOptions.find((item) => item.id === rankingMetric) ?? rankingMetricOptions[0];
  const rankedPlayers = useMemo(() => [...rankingPlayers].sort((a, b) => {
    const difference = rankingMetricValue(b, rankingMetric) - rankingMetricValue(a, rankingMetric);
    return difference || b.games - a.games || a.name.localeCompare(b.name);
  }), [rankingPlayers, rankingMetric]);
  const rankingTablePlayers = useMemo(() => {
    const term = rankingSearch.trim().toLowerCase();
    const direction = rankingSortDirection === "asc" ? 1 : -1;
    return rankingPlayers.filter((player) => {
      if (term && !player.name.toLowerCase().includes(term)) return false;
      if (rankingParticipationFilter === "played") return player.games > 0;
      if (rankingParticipationFilter === "waiting") return player.games === 0;
      return true;
    }).sort((first, second) => {
      if (rankingTableSort === "name") return first.name.localeCompare(second.name) * direction;
      const difference = rankingTableValue(first, rankingTableSort) - rankingTableValue(second, rankingTableSort);
      return difference * direction || first.name.localeCompare(second.name);
    });
  }, [rankingPlayers, rankingSearch, rankingParticipationFilter, rankingTableSort, rankingSortDirection]);
  const rankingFiltersActive = !!rankingSearch.trim() || rankingParticipationFilter !== "all" || rankingTableSort !== "impact" || rankingSortDirection !== "desc";
  const chooseRankingTableSort = (sort: RankingTableSort) => {
    setRankingSortDirection(rankingTableSort === sort ? (rankingSortDirection === "desc" ? "asc" : "desc") : sort === "name" ? "asc" : "desc");
    setRankingTableSort(sort);
  };
  const resetRankingTable = () => {
    setRankingSearch(""); setRankingParticipationFilter("all"); setRankingTableSort("impact"); setRankingSortDirection("desc");
  };
  const rankingPeak = Math.max(1, ...rankedPlayers.map((player) => Math.abs(rankingMetricValue(player, rankingMetric))));
  const topRunsAverage = [...players].filter((player) => player.games > 0).sort((a, b) => b.runsAverage - a.runsAverage)[0];
  const topStrikeRate = [...players].filter((player) => player.games > 0).sort((a, b) => b.strikeRate - a.strikeRate)[0];
  const homeLatestMatch = seasonActivities[0] ?? teamActivities[0] ?? null;
  const homeLatestIsHome = !!homeLatestMatch && homeLatestMatch.homeTeam.toLowerCase() === team?.name.toLowerCase();
  const homeLatestTeamScore = homeLatestMatch ? (homeLatestIsHome ? homeLatestMatch.homeScore : homeLatestMatch.awayScore) : 0;
  const homeLatestOpponentScore = homeLatestMatch ? (homeLatestIsHome ? homeLatestMatch.awayScore : homeLatestMatch.homeScore) : 0;
  const homeLatestOpponent = homeLatestMatch ? (homeLatestIsHome ? homeLatestMatch.awayTeam : homeLatestMatch.homeTeam) : "Opponent";
  const homeLatestOutcome = !homeLatestMatch ? "" : homeLatestTeamScore > homeLatestOpponentScore ? "WIN" : homeLatestTeamScore < homeLatestOpponentScore ? "LOSS" : "DRAW";
  const homeLatestTopPerformance = homeLatestMatch ? [...homeLatestMatch.performances]
    .filter((item) => !team || item.teamName.toLowerCase() === team.name.toLowerCase())
    .sort((a, b) => b.contribution - a.contribution)[0] : undefined;
  const homeForm = seasonActivities.slice(0, 5).map((match) => {
    const isHome = match.homeTeam.toLowerCase() === team?.name.toLowerCase();
    const scored = isHome ? match.homeScore : match.awayScore;
    const conceded = isHome ? match.awayScore : match.homeScore;
    return scored > conceded ? "W" : scored < conceded ? "L" : "D";
  });
  const homeRunDifference = seasonTeamSummary.scored - seasonTeamSummary.conceded;
  const scorecardHome = scorecardMatch?.performances.filter((item) => item.teamName.toLowerCase() === scorecardMatch.homeTeam.toLowerCase()) ?? [];
  const scorecardAway = scorecardMatch?.performances.filter((item) => item.teamName.toLowerCase() === scorecardMatch.awayTeam.toLowerCase()) ?? [];
  const scorecardRows = scorecardMatch?.performances ?? [];
  const scorecardLeaders = {
    runs: [...scorecardRows].sort((a, b) => b.runs - a.runs)[0],
    wickets: [...scorecardRows].sort((a, b) => b.wickets - a.wickets)[0],
    contribution: [...scorecardRows].sort((a, b) => b.contribution - a.contribution)[0],
  };
  const scorecardTeamAnalysis = (teamName: string) => {
    const battingInnings = scorecardMatch?.innings?.find((innings) => innings.battingTeam.toLowerCase() === teamName.toLowerCase());
    const bowlingInnings = scorecardMatch?.innings?.find((innings) => innings.battingTeam.toLowerCase() !== teamName.toLowerCase());
    const battingDeliveries = battingInnings?.pairs.flatMap((pair) => pair.overs.flatMap((over) => over.deliveries)) ?? [];
    const bowlingDeliveries = bowlingInnings?.pairs.flatMap((pair) => pair.overs.flatMap((over) => over.deliveries)) ?? [];
    const isHome = scorecardMatch?.homeTeam.toLowerCase() === teamName.toLowerCase();
    const runs = isHome ? scorecardMatch?.homeScore ?? 0 : scorecardMatch?.awayScore ?? 0;
    const wicketsLost = battingDeliveries.filter((delivery) => isDismissalOutcome(delivery.outcome)).length;
    const extrasGiven = bowlingDeliveries.filter((delivery) => isExtraOutcome(delivery.outcome)).length;
    const dotBallsBowled = bowlingDeliveries.filter((delivery) => deliveryRunValue(delivery.outcome) === 0).length;
    const boundaries = battingDeliveries.filter((delivery) => (deliveryRunValue(delivery.outcome) ?? 0) >= 4).length;
    return {
      name: teamName,
      runs,
      wicketsLost,
      wicketsTaken: bowlingDeliveries.filter((delivery) => isDismissalOutcome(delivery.outcome)).length,
      extrasGiven,
      dotBallsBowled,
      dotPressure: bowlingDeliveries.length ? Math.round(dotBallsBowled / bowlingDeliveries.length * 100) : 0,
      boundaries,
      skins: isHome ? scorecardMatch?.homeSkins ?? 0 : scorecardMatch?.awaySkins ?? 0,
      battingDeliveries: battingDeliveries.length,
    };
  };
  const scorecardHomeAnalysis = scorecardTeamAnalysis(scorecardMatch?.homeTeam ?? "Home");
  const scorecardAwayAnalysis = scorecardTeamAnalysis(scorecardMatch?.awayTeam ?? "Away");
  const scorecardWinnerAnalysis = scorecardHomeAnalysis.runs > scorecardAwayAnalysis.runs ? scorecardHomeAnalysis : scorecardAwayAnalysis.runs > scorecardHomeAnalysis.runs ? scorecardAwayAnalysis : null;
  const scorecardLoserAnalysis = scorecardWinnerAnalysis?.name === scorecardHomeAnalysis.name ? scorecardAwayAnalysis : scorecardHomeAnalysis;
  const scorecardRunScale = Math.max(scorecardHomeAnalysis.runs, scorecardAwayAnalysis.runs, 1);

  async function refreshCalculatedStats() {
    try {
      const [teamResponse, playerResponse] = await Promise.all([fetch("/api/teams"), fetch("/api/players")]);
      if (!teamResponse.ok || !playerResponse.ok) return false;
      const [teamData, playerData] = await Promise.all([teamResponse.json(), playerResponse.json()]);
      setTeams(teamData.teams ?? []);
      setProfiles(playerData.players ?? []);
      setDirectoryProfiles(playerData.directory ?? playerData.players ?? []);
      return true;
    } catch {
      return false;
    }
  }

  async function setRosterPlayerActive(player: Player, active: boolean) {
    if (!team || !season) return;
    if (!active) {
      const hasHistory = (player.linkedAppearances ?? player.games) > 0;
      const confirmed = window.confirm(`Remove ${player.name} from ${season.name || "the current season"}'s active roster?\n\n${hasHistory ? "Their completed match statistics will remain visible as former-player history." : "Their zero-stat roster card will disappear from the player directory."} Their permanent profile will not be deleted.`);
      if (!confirmed) return;
      const password = window.prompt("Enter the roster removal password to authorize this action:");
      if (password === null) return setNotice("Roster removal cancelled. Authorization required to remove roster members.");
      if (password !== "Johan123") return setNotice("Incorrect password. Authorization required to remove roster members.");
    }
    setWorking("season"); setNotice("");
    const response = await fetch("/api/teams", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setRosterPlayerActive", teamId: team.id, seasonId: season.id, seasonPlayerId: player.id, active }) });
    const data = await response.json();
    if (!response.ok) { setWorking(""); return setNotice(data.error ?? "Could not update that roster player."); }
    setTeams((current) => current.map((item) => item.id === data.team.id ? data.team : item));
    await refreshCalculatedStats();
    setWorking("");
    setNotice(active
      ? `${player.name} was restored to ${season.name || "the current season"}'s active roster.`
      : `${player.name} was removed from the active roster. Their permanent profile and match history remain protected.`);
  }

  async function addSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!team) return;
    setWorking("season"); setNotice("");
    const payload = teamUrl.trim()
      ? { sourceUrl: teamUrl, teamId: team.id, seasonName: newSeasonName, leagueName: newSeasonLeague, externalSeasonId: newSeasonExternalId }
      : { action: "createSeason", teamId: team.id, seasonName: newSeasonName, leagueName: newSeasonLeague, externalSeasonId: newSeasonExternalId };
    const response = await fetch("/api/teams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json(); setWorking("");
    if (!response.ok) return setNotice(data.error ?? "Could not add that season.");
    setTeams((current) => current.map((item) => item.id === data.team.id ? data.team : item));
    const added = data.team.seasons?.find((item: Season) => item.isCurrent) ?? data.team.seasons?.[0];
    setSelectedSeasonId(added?.id ?? null);
    setScorecardSeasonId(added?.id ?? null);
    setNewSeasonName(""); setNewSeasonLeague(""); setNewSeasonExternalId(""); setTeamUrl("");
    setNotice(`${added?.name || `Season ${added?.externalSeasonId}`} was added and is now current.`);
  }

  async function importSeasonRoster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!team || !season || !teamUrl.trim()) return;
    setWorking("season"); setNotice("");
    const response = await fetch("/api/teams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceUrl: teamUrl, teamId: team.id, seasonName: season.name, leagueName: season.leagueName, externalSeasonId: season.externalSeasonId }) });
    const data = await response.json(); setWorking("");
    if (!response.ok) return setNotice(data.error ?? "Could not import that season roster.");
    setTeams((current) => current.map((item) => item.id === data.team.id ? data.team : item));
    const updatedSeason = data.team.seasons?.find((item: Season) => item.externalSeasonId === season.externalSeasonId) ?? data.team.seasons?.[0];
    setSelectedSeasonId(updatedSeason?.id ?? null); setTeamUrl("");
    setNotice(`${updatedSeason?.players?.length ?? 0} roster players imported for ${updatedSeason?.name || `Season ${season.externalSeasonId}`}.`);
  }

  async function editSeason(event: FormEvent<HTMLFormElement>, seasonId: number) {
    event.preventDefault(); if (!team) return;
    const form = new FormData(event.currentTarget);
    setWorking("season"); setNotice("");
    const response = await fetch("/api/teams", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "editSeason", teamId: team.id, seasonId, seasonName: form.get("seasonName"), leagueName: form.get("leagueName"), externalSeasonId: form.get("externalSeasonId") }) });
    const data = await response.json(); setWorking("");
    if (!response.ok) return setNotice(data.error ?? "Could not update that season.");
    setTeams((current) => current.map((item) => item.id === data.team.id ? data.team : item));
    setNotice("Season details updated. Games and player history remain linked.");
  }

  async function deleteSeason(seasonToDelete: Season) {
    if (!team) return;
    const confirmed = window.confirm(`Delete ${seasonToDelete.name || `Season ${seasonToDelete.externalSeasonId}`} from Team Admin?\n\nPlayer career records will be preserved. A season with linked games cannot be deleted until those results are moved.`);
    if (!confirmed) return;
    setWorking("season"); setNotice("");
    const response = await fetch("/api/teams", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: team.id, seasonId: seasonToDelete.id }) });
    const data = await response.json(); setWorking("");
    if (!response.ok) return setNotice(data.error ?? "Could not delete that season.");
    setTeams((current) => current.map((item) => item.id === data.team.id ? data.team : item));
    const next = data.team.seasons?.find((item: Season) => item.isCurrent) ?? data.team.seasons?.[0];
    setSelectedSeasonId(next?.id ?? null);
    if (scorecardSeasonId === seasonToDelete.id) setScorecardSeasonId(next?.id ?? null);
    setNotice(`${seasonToDelete.name || `Season ${seasonToDelete.externalSeasonId}`} was removed from Team Admin. Player career history was preserved.`);
  }

  async function makeSeasonCurrent(seasonId: number) {
    if (!team) return;
    setWorking("season"); setNotice("");
    const response = await fetch("/api/teams", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: team.id, seasonId }) });
    const data = await response.json(); setWorking("");
    if (!response.ok) return setNotice(data.error ?? "Could not change the current season.");
    setTeams((current) => current.map((item) => item.id === data.team.id ? data.team : item));
    setSelectedSeasonId(seasonId);
    setScorecardSeasonId(seasonId);
    const next = data.team.seasons?.find((item: Season) => item.id === seasonId);
    setNotice(`Season ${next?.externalSeasonId ?? "selected"} is now current. New scorecards will be filed there automatically.`);
  }

  async function uploadMatches(event: FormEvent) {
    event.preventDefault(); setWorking("match"); setNotice(""); setScorecardImportFeedback(null);
    const fail = (message: string) => { setWorking(""); setNotice(message); setScorecardImportFeedback({ tone: "error", message }); };
    if (!scorecardFiles.length) return fail("Choose one or more completed HTML scorecards first.");
    if (!scorecardImportSeason) return fail("Choose a season before importing scorecards.");
    const form = new FormData();
    form.append("teamSeasonId", String(scorecardImportSeason.id));
    form.append("matchType", scorecardMatchType);
    scorecardFiles.forEach((file) => form.append("scorecards", file));
    try {
      const response = await fetch("/api/scoresheets", { method: "POST", body: form });
      const responseText = await response.text();
      const data = (() => {
        try { return JSON.parse(responseText) as { error?: string; matches?: MatchActivity[]; failed?: Array<{ error: string }> }; }
        catch { return { error: responseText.trim() || "The server returned an unreadable response. Please try again." }; }
      })();
      setWorking("");
      if (!response.ok) return fail(data.error ?? "Could not import those scorecards.");
      const imported = (data.matches ?? []) as MatchActivity[];
      if (!imported.length) return fail("The import finished without a saved match. Please check the scorecard and try again.");
      setActivities((current) => [...imported, ...current.filter((item) => !imported.some((match) => match.id === item.id))]);
      await refreshCalculatedStats();
      setScorecardFiles([]); setUploadInputKey((key) => key + 1);
      const failed = data.failed?.length ? ` ${data.failed[0].error}` : "";
      const seasonMatchCount = imported.filter((match) => match.teamSeasonId === scorecardImportSeason.id).length;
      const fillerCount = imported.length - seasonMatchCount;
      const message = `${imported.length} ${matchTypeLabel(scorecardMatchType).toLowerCase()} match${imported.length === 1 ? "" : "es"} saved. ${seasonMatchCount} ${team?.name ?? "team"} result${seasonMatchCount === 1 ? "" : "s"} filed under ${scorecardImportSeason.name || `Season ${scorecardImportSeason.externalSeasonId}`}.${fillerCount ? ` ${fillerCount} other-team scorecard${fillerCount === 1 ? " is" : "s are"} available for filler history.` : ""}${failed}`;
      setScorecardImportFeedback({ tone: "success", message }); setNotice(message);
      if (imported.length === 1) openScorecard(imported[0].id);
    } catch {
      fail("ActionHQ could not reach the import service. Check that the local server is running, then try again.");
    }
  }

  async function moveMatchToSeason(matchId: number, teamSeasonId: number) {
    setWorking("season"); setNotice("");
    const response = await fetch("/api/scoresheets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: matchId, teamSeasonId }) });
    const data = await response.json(); setWorking("");
    if (!response.ok) return setNotice(data.error ?? "Could not move that game.");
    setActivities((current) => current.map((match) => match.id === matchId ? data.match : match));
    await refreshCalculatedStats();
    const destination = team?.seasons.find((item) => item.id === teamSeasonId);
    setNotice(`Game moved to ${destination?.name || "the selected season"}. Player all-time history is unchanged.`);
  }

  async function addKudos(id: number) {
    if (!profile) return setNotice("Register a player profile before giving kudos.");
    const response = await fetch("/api/scoresheets", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, playerId: profile.id }) });
    if (!response.ok) return;
    const data = await response.json();
    setActivities((current) => current.map((match) => match.id === id ? data.match : match));
  }

  async function linkFillerAppearance(sourceName?: string) {
    if (!profile) return;
    setWorking("filler"); setNotice(""); setScorecardCandidates([]);
    const fixtureId = fillerFixtureId.trim();
    const response = await fetch("/api/players", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerId: profile.id, fixtureId, sourceName }) });
    const data = await response.json(); setWorking("");
    if (!response.ok) {
      setScorecardCandidates(data.candidates ?? []);
      return setNotice(data.error ?? "Could not link that appearance.");
    }
    setProfiles((current) => [data.player, ...current.filter((item) => item.id !== data.player.id)]);
    setDirectoryProfiles((current) => [data.player, ...current.filter((item) => item.id !== data.player.id)]);
    setNotice(`Fixture ${fixtureId} is now part of ${data.player.displayName}'s all-time record.`);
  }

  async function shareMatch(match: MatchActivity) {
    const text = `${match.homeTeam} ${match.homeScore}–${match.awayScore} ${match.awayTeam} · ActionHQ Fixture ${match.fixtureId}`;
    const shareUrl = window.location.href;
    if (navigator.share) await navigator.share({ title: "ActionHQ match", text, url: shareUrl });
    else { await navigator.clipboard?.writeText(`${text}\n${shareUrl}`); setNotice("Match summary copied."); }
  }

  async function removeMatch(match: MatchActivity) {
    const confirmed = window.confirm(`Remove Fixture ${match.fixtureId} from the portal?\n\nThe game will be excluded from every team and player statistic. Its player links remain safely archived, so uploading the HTML scorecard again restores it.`);
    if (!confirmed) return;
    setWorking("remove"); setNotice("");
    const response = await fetch("/api/scoresheets", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: match.id }) });
    const data = await response.json();
    if (!response.ok) { setWorking(""); return setNotice(data.error ?? "Could not remove that game."); }
    setActivities((current) => current.filter((item) => item.id !== match.id));
    const refreshed = await refreshCalculatedStats();
    setWorking("");
    if (scorecardMatchId === match.id) { setScorecardMatchId(null); setView("feed"); }
    setNotice(refreshed
      ? `Fixture ${match.fixtureId} was removed and every team and player statistic was recalculated.`
      : `Fixture ${match.fixtureId} was removed. Refresh the page to see the recalculated statistics.`);
  }

  async function toggleFollow(followingId: number) {
    if (!profile) return setNotice("Register a player profile to follow players.");
    setWorking("community");
    const response = await fetch("/api/community", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "follow", followerId: profile.id, followingId }) });
    const data = await response.json(); setWorking("");
    if (!response.ok) return setNotice(data.error ?? "Could not update following.");
    if (data.following) setFollows((current) => [data.follow, ...current]); else setFollows((current) => current.filter((item) => item.id !== data.id));
  }

  async function saveAccount(event: FormEvent) {
    event.preventDefault(); if (!profile) return;
    setWorking("account"); setNotice("");
    const response = await fetch("/api/players", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", playerId: profile.id, displayName: accountName, email: accountEmail, phone: accountPhone, bio: accountBio, role: accountRole, preferredVenue: accountVenue, imageUrl: accountImage }) });
    const data = await response.json(); setWorking("");
    if (!response.ok) return setNotice(data.error ?? "Could not save your profile.");
    setProfiles((current) => current.map((item) => item.id === data.player.id ? data.player : item)); setNotice("Profile settings saved.");
  }

  async function saveTeamImage(imageUrl: string | null) {
    if (!team) return;
    setWorking("account"); setNotice("");
    const response = await fetch("/api/teams", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setTeamImage", teamId: team.id, imageUrl }) });
    const data = await response.json(); setWorking("");
    if (!response.ok) return setNotice(data.error ?? "Could not update the team image.");
    setTeams((current) => current.map((item) => item.id === data.team.id ? data.team : item));
    setNotice(imageUrl ? "Team image updated." : "Team image removed.");
  }

  async function savePlayerImage(playerId: number, imageUrl: string | null) {
    setWorking("account"); setNotice("");
    const response = await fetch("/api/players", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "setPlayerImage", playerId, imageUrl }) });
    const data = await response.json(); setWorking("");
    if (!response.ok) return setNotice(data.error ?? "Could not update the player photo.");
    setProfiles((current) => current.map((item) => item.id === playerId ? { ...item, imageUrl } : item));
    setDirectoryProfiles((current) => current.map((item) => item.id === playerId ? { ...item, imageUrl } : item));
    if (selectedProfileId === playerId) setAccountImage(imageUrl);
    setNotice(imageUrl ? "Player photo updated." : "Player photo removed.");
  }

  function openPublicPlayer(id: number) { setViewedProfileId(id); setPlayerSeasonFilter("all"); setView("player"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function openScorecard(id: number) { setScorecardMatchId(id); setScorecardInningsNumber(1); setView("scorecard"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function navigateTo(nextView: View) { setView(nextView); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function openTeamSection(id: string) {
    setView("team");
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }
  const navItems: Array<{ id: View; label: string; mobileLabel: string; icon: ReactNode }> = [
    { id: "feed", label: "Home", mobileLabel: "Home", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg> },
    { id: "players", label: "Players", mobileLabel: "Players", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M2.6 20c0-3.6 2.9-6 6.4-6s6.4 2.4 6.4 6"/><path d="M16.8 5.3a3 3 0 0 1 0 5.6"/><path d="M18 14.2c2.3.5 3.7 2.3 3.7 4.9"/></svg> },
    { id: "performance", label: "Team Stats", mobileLabel: "Stats", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v16h16"/><path d="M7.5 14l3.2-3.3 3 3L21 7.5"/></svg> },
    { id: "fixtures", label: "Games & Scores", mobileLabel: "Games", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.3"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.3"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.3"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.3"/></svg> },
    { id: "leaderboards", label: "Rankings", mobileLabel: "Rankings", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v1.4A3.6 3.6 0 0 0 7.6 11M17 6h3v1.4A3.6 3.6 0 0 1 16.4 11"/><path d="M12 13v3.5M8.5 21h7M9.6 21l.6-4h3.6l.6 4"/></svg> },
    { id: "consistency", label: "Consistency", mobileLabel: "Consistency", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12h4l2-6 3 12 2-9 1.5 3h6.5"/></svg> },
    { id: "team", label: "Team Admin", mobileLabel: "Team", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7.5 3v5.6c0 4.3-3.2 7.5-7.5 9.4-4.3-1.9-7.5-5.1-7.5-9.4V6z"/><path d="M9.2 12.1l1.9 1.9 3.8-3.9"/></svg> },
  ];

  return <PlayerImageContext.Provider value={playerImages}><main className="app-root">
    <header className="app-header"><button className="wordmark" onClick={() => navigateTo("feed")}><i />ACTION<span>HQ</span><small>BETA</small></button><form className="header-search" onSubmit={(event) => { event.preventDefault(); navigateTo("search"); }}><span>⌕</span><input aria-label="Search players or fixtures" value={searchQuery} onFocus={() => navigateTo("search")} onChange={(event) => { setSearchQuery(event.target.value); setView("search"); }} placeholder="Search Die Bron players or fixture IDs" /></form><button className="header-search-compact" aria-label="Open search" onClick={() => navigateTo("search")}>⌕ <span>Search</span></button><button className="sync-quick" onClick={() => openTeamSection("scorecard-imports")}>＋ Update scores</button><button className="team-button" aria-label="Open Team Admin" onClick={() => navigateTo("team")}><Initials name={team?.name ?? "Die Bron"} src={team?.imageUrl ?? null} /><span className="team-button-copy"><strong>{team?.name ?? "Die Bron"}</strong><small>Single-team portal</small></span><b>→</b></button></header>

    <div className="app-layout">
      <aside className="sidebar">
        <nav aria-label="Main navigation">{navItems.map((item) => <button key={item.id} className={`${view === item.id ? "active" : ""}${item.id === "team" ? " admin-nav" : ""}`} onClick={() => navigateTo(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
        <div className="side-divider" />
        <p className="side-label side-label-count"><span>TEAM PLAYER PROFILES</span><b>{teamDirectory.length}</b></p>
        <div className="club-stack page-stack">{teamDirectory.map((item) => <button key={`player-${item.id}`} className={`club-link ${item.id === viewedProfileId && view === "player" ? "selected" : ""}`} onClick={() => openPublicPlayer(item.id)}><Initials name={item.displayName} src={item.imageUrl} /><span><b>{item.displayName}</b><small>Player profile · {item.allTime.linkedMatches} scorecards</small></span></button>)}</div>
        {!teamDirectory.length && <button className="club-link empty" onClick={() => navigateTo("team")}>Open roster management</button>}
        <button className="add-club" onClick={() => navigateTo("players")}>View all {teamDirectory.length || "team"} player profiles →</button>
        <div className="sidebar-promo"><span>TEAM ANALYSIS</span><strong>See how the team scores, defends and wins.</strong><button onClick={() => navigateTo("performance")}>Open team stats</button></div>
        <button className="side-foot" onClick={() => navigateTo("privacy")}>Privacy · POPIA · Support<br />Made for the indoor game 🇿🇦</button>
      </aside>

      <section className="main-column">
        {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}

        {view === "feed" && <>
          {team ? <>
            <section className="home-team-hero">
              <div className="home-hero-rings" />
              <header><div className="home-team-identity"><Initials name={team.name} large src={team.imageUrl} /><span><small>YOUR TEAM HQ</small><strong>{team.name}</strong></span></div><div className="home-season-chip"><span>CURRENT VIEW</span><b>{season?.name ?? `Season ${season?.externalSeasonId ?? "current"}`}</b><small>{season?.leagueName ?? "Action Cricket"}</small></div></header>
              
              <div className="home-record-grid"><article><span>GAMES</span><strong>{seasonTeamSummary.games}</strong><small>scorecards</small></article><article className="positive"><span>WINS</span><strong>{seasonTeamSummary.wins}</strong><small>{seasonTeamSummary.games ? Math.round(seasonTeamSummary.wins / seasonTeamSummary.games * 100) : 0}% win rate</small></article><article><span>LOSSES</span><strong>{seasonTeamSummary.losses}</strong><small>{seasonTeamSummary.draws} draws</small></article><article className={homeRunDifference >= 0 ? "positive" : "negative"}><span>RUN DIFFERENCE</span><strong>{homeRunDifference > 0 ? "+" : ""}{homeRunDifference}</strong><small>{seasonTeamSummary.averageScored} scored / game</small></article></div>
              <footer><div className="home-form-strip"><span>RECENT FORM</span><div>{homeForm.length ? homeForm.map((result, index) => <b className={result.toLowerCase()} key={`${result}-${index}`}>{result}</b>) : <small>No completed games yet</small>}</div></div><div className="home-hero-actions"><button onClick={() => openTeamSection("scorecard-imports")}>＋ Update scores</button><button onClick={() => navigateTo("leaderboards")}>Explore team intelligence →</button></div></footer>
            </section>

            <section className="home-command-grid" aria-label="Team shortcuts"><button className="featured" onClick={() => navigateTo("performance")}><span>↗</span><div><small>TEAM INTELLIGENCE</small><strong>Explore team stats</strong><p>Scoring, pressure, consistency and match patterns.</p></div><em>→</em></button><button onClick={() => navigateTo("players")}><span>●</span><div><small>THE SQUAD</small><strong>Open player pages</strong><p>{teamDirectory.length} permanent profiles.</p></div><em>→</em></button><button onClick={() => navigateTo("fixtures")}><span>▦</span><div><small>MATCH CENTRE</small><strong>Games &amp; scores</strong><p>{teamActivities.length} completed results.</p></div><em>→</em></button></section>

            <div className="home-dashboard-grid">
              <section className="home-latest-card">
                <header><div><p className="overline">LATEST RESULT</p><h2>{homeLatestMatch ? `${team.name} vs ${homeLatestOpponent}` : "Your latest match"}</h2></div>{homeLatestMatch && <button onClick={() => openScorecard(homeLatestMatch.id)}>Full scorecard →</button>}</header>
                {homeLatestMatch ? <><div className="home-result-score"><span><Initials name={team.name} src={team.imageUrl} /><b>{team.name}</b><strong>{homeLatestTeamScore}</strong></span><i><b className={homeLatestOutcome.toLowerCase()}>{homeLatestOutcome}</b><small>{homeLatestMatch.playedAt}</small></i><span><strong>{homeLatestOpponentScore}</strong><b>{homeLatestOpponent}</b><Initials name={homeLatestOpponent} /></span></div></> : <div className="home-panel-empty"><strong>No completed result yet.</strong><span>Upload the first scorecard and the season story will start here.</span><button onClick={() => openTeamSection("scorecard-imports")}>Update scores</button></div>}
              </section>

              <section className="home-leaders-card"><header><div><p className="overline">SEASON LEADERS</p><h2>Who is setting the pace</h2></div><button onClick={() => navigateTo("leaderboards")}>Rankings →</button></header><div>{[
                { label: "MOST RUNS", player: topRuns[0], value: topRuns[0]?.runs ?? 0, unit: "RUNS" },
                { label: "MOST WICKETS", player: topWickets[0], value: topWickets[0]?.wickets ?? 0, unit: "WKTS" },
                { label: "TOP IMPACT", player: players[0], value: players[0]?.contribution ?? 0, unit: "IMPACT" },
              ].map((leader) => <button key={leader.label} onClick={() => { const target = leader.player?.linkedOwnerId ?? leader.player?.playerProfileId; if (target) openPublicPlayer(target); }}><span>{leader.label}</span><Initials name={leader.player?.name ?? "Player"} /><b>{leader.player?.name ?? "Waiting for scorecards"}</b><strong>{leader.value}<small>{leader.unit}</small></strong></button>)}</div></section>
            </div>

            <section className="home-recent-card"><header><div><p className="overline">SEASON SCORECARDS</p><h2>Recent games</h2></div><button onClick={() => navigateTo("fixtures")}>Open match centre →</button></header>{seasonActivities.length ? <div className="home-result-list">{seasonActivities.slice(0, 5).map((match) => { const isHome = match.homeTeam.toLowerCase() === team.name.toLowerCase(); const teamScore = isHome ? match.homeScore : match.awayScore; const opponentScore = isHome ? match.awayScore : match.homeScore; const opponent = isHome ? match.awayTeam : match.homeTeam; const result = teamScore > opponentScore ? "W" : teamScore < opponentScore ? "L" : "D"; return <button key={match.id} onClick={() => openScorecard(match.id)}><span className={`home-result-badge ${result.toLowerCase()}`}>{result}</span><span><b>{opponent}</b><small>{match.playedAt} · {matchTypeLabel(match.matchType)}</small></span><strong>{teamScore}<i>–</i>{opponentScore}</strong><em>Fixture {match.fixtureId}</em><b>→</b></button>; })}</div> : <div className="home-panel-empty compact"><strong>No scorecards in this season.</strong><span>Add a completed result from Team Admin.</span></div>}</section>
          </> : loading ? <section className="home-no-team"><span>◉</span><p className="overline">ACTIONHQ · DIE BRON</p><h1>Loading your team…</h1><p>Fetching Die Bron seasons, roster and scorecards.</p></section> : <section className="home-no-team"><span>◉</span><p className="overline">ACTIONHQ · DIE BRON</p><h1>The team data could not be loaded.</h1><p>This is a single-team portal. Open Team Admin to check the stored season and roster data.</p><button onClick={() => navigateTo("team")}>Open Team Admin →</button></section>}
        </>}

        {view === "scorecard" && scorecardMatch && <>
          <div className="scorecard-toolbar"><button onClick={() => navigateTo("feed")}>← Back to activity</button><div><button onClick={() => addKudos(scorecardMatch.id)} className={scorecardMatch.liked ? "liked" : ""}>♥ {scorecardMatch.kudos || "Kudos"}</button><button onClick={() => shareMatch(scorecardMatch)}>↗ Share</button>{canManageTeam && teamActivities.some((match) => match.id === scorecardMatch.id) && <button className="remove-game" disabled={working === "remove"} onClick={() => removeMatch(scorecardMatch)}>Remove game</button>}</div></div>
          <section className="internal-scorecard">
            <div className="scorecard-heading"><div><p>ACTION CRICKET · {matchTypeLabel(scorecardMatch.matchType).toUpperCase()} · FIXTURE {scorecardMatch.fixtureId}</p><span>{scorecardMatch.playedAt}</span></div><em>{matchTypeLabel(scorecardMatch.matchType)} · FINAL</em></div>
            <div className="scorecard-result"><div><Initials name={scorecardMatch.homeTeam} large /><span><b>{scorecardMatch.homeTeam}</b><small>{scorecardMatch.homeSkins} skins · {scorecardMatch.homePoints} league points</small></span><strong>{scorecardMatch.homeScore}</strong></div><i><span>{scorecardMatch.homeScore > scorecardMatch.awayScore ? `${scorecardMatch.homeTeam} won` : scorecardMatch.awayScore > scorecardMatch.homeScore ? `${scorecardMatch.awayTeam} won` : "Match tied"}</span><b>{Math.abs(scorecardMatch.homeScore - scorecardMatch.awayScore)} run margin</b></i><div><strong>{scorecardMatch.awayScore}</strong><span><b>{scorecardMatch.awayTeam}</b><small>{scorecardMatch.awaySkins} skins · {scorecardMatch.awayPoints} league points</small></span><Initials name={scorecardMatch.awayTeam} large /></div></div>
            <div className="skins-scorecard"><div className="mobile-scroll-hint dark">Swipe to see every skin →</div><div className="skin-row skin-head"><span>TEAM</span><b>SKIN 1</b><b>SKIN 2</b><b>SKIN 3</b><b>SKIN 4</b><strong>TOTAL</strong><em>SKINS</em><em>PTS</em></div><div className="skin-row"><span>{scorecardMatch.homeTeam}</span>{[scorecardMatch.homeSkin1, scorecardMatch.homeSkin2, scorecardMatch.homeSkin3, scorecardMatch.homeSkin4].map((score, index) => <b className={score > [scorecardMatch.awaySkin1, scorecardMatch.awaySkin2, scorecardMatch.awaySkin3, scorecardMatch.awaySkin4][index] ? "won" : ""} key={index}>{score}</b>)}<strong>{scorecardMatch.homeScore}</strong><em>{scorecardMatch.homeSkins}</em><em>{scorecardMatch.homePoints}</em></div><div className="skin-row"><span>{scorecardMatch.awayTeam}</span>{[scorecardMatch.awaySkin1, scorecardMatch.awaySkin2, scorecardMatch.awaySkin3, scorecardMatch.awaySkin4].map((score, index) => <b className={score > [scorecardMatch.homeSkin1, scorecardMatch.homeSkin2, scorecardMatch.homeSkin3, scorecardMatch.homeSkin4][index] ? "won" : ""} key={index}>{score}</b>)}<strong>{scorecardMatch.awayScore}</strong><em>{scorecardMatch.awaySkins}</em><em>{scorecardMatch.awayPoints}</em></div></div>
          </section>

          <div className="scorecard-highlights"><article><span>PLAYER OF THE MATCH</span><Initials name={scorecardMatch.playerOfMatch || scorecardLeaders.contribution?.playerName || "Player"} /><div><b>{scorecardMatch.playerOfMatch || scorecardLeaders.contribution?.playerName || "Not awarded"}</b><small>Official match award</small></div></article><article><span>TOP SCORE</span><strong>{scorecardLeaders.runs?.runs ?? 0}</strong><div><b>{scorecardLeaders.runs?.playerName ?? "—"}</b><small>{scorecardLeaders.runs?.teamName ?? ""}</small></div></article><article><span>MOST WICKETS</span><strong>{scorecardLeaders.wickets?.wickets ?? 0}</strong><div><b>{scorecardLeaders.wickets?.playerName ?? "—"}</b><small>{scorecardLeaders.wickets?.teamName ?? ""}</small></div></article><article><span>TOP IMPACT</span><strong>{scorecardLeaders.contribution?.contribution ?? 0}</strong><div><b>{scorecardLeaders.contribution?.playerName ?? "—"}</b><small>Contribution</small></div></article></div>

          <section className="match-intelligence-panel"><div className="section-title"><div><p className="overline">MATCH INTELLIGENCE</p><h2>How the game was won</h2></div><span>Runs, wickets, extras and pressure from every delivery</span></div><div className="match-verdict"><span>{scorecardWinnerAnalysis ? "DECIDING EDGE" : "MATCH BALANCE"}</span><strong>{scorecardWinnerAnalysis ? `${scorecardWinnerAnalysis.name} won by ${Math.abs(scorecardHomeAnalysis.runs - scorecardAwayAnalysis.runs)} runs` : "The scores finished level"}</strong><p>{scorecardWinnerAnalysis ? `${scorecardWinnerAnalysis.name} lost ${scorecardWinnerAnalysis.wicketsLost} wickets, gave away ${scorecardWinnerAnalysis.extrasGiven} extra deliveries and created ${scorecardWinnerAnalysis.dotPressure}% dot-ball pressure. ${scorecardWinnerAnalysis.extrasGiven < scorecardLoserAnalysis.extrasGiven ? `They conceded ${scorecardLoserAnalysis.extrasGiven - scorecardWinnerAnalysis.extrasGiven} fewer extras than ${scorecardLoserAnalysis.name}.` : `${scorecardLoserAnalysis.name} was more disciplined on extras, so the scoring and wicket margins made the difference.`}` : "Neither team created a final-score advantage; compare wickets, extras and skins below to see where momentum shifted."}</p></div><div className="match-intelligence-kpis"><article><span>RUN MARGIN</span><strong>{Math.abs(scorecardHomeAnalysis.runs - scorecardAwayAnalysis.runs)}</strong><small>{scorecardWinnerAnalysis?.name ?? "Tied result"}</small></article><article><span>WICKET EDGE</span><strong>{Math.abs(scorecardHomeAnalysis.wicketsLost - scorecardAwayAnalysis.wicketsLost)}</strong><small>difference in dismissals</small></article><article><span>EXTRAS EDGE</span><strong>{Math.abs(scorecardHomeAnalysis.extrasGiven - scorecardAwayAnalysis.extrasGiven)}</strong><small>extra deliveries conceded</small></article><article><span>SKINS EDGE</span><strong>{Math.abs(scorecardHomeAnalysis.skins - scorecardAwayAnalysis.skins)}</strong><small>skins difference</small></article></div><div className="match-analysis-grid"><article className="runs-wickets-chart"><header><div><span>RUNS VS WICKETS</span><strong>Scoring output and wicket risk</strong></div><small>Longer bar = more runs</small></header>{[scorecardHomeAnalysis, scorecardAwayAnalysis].map((side) => <div className="match-balance-row" key={side.name}><span><Initials name={side.name} /><b>{side.name}</b></span><div><i><em style={{ width: `${side.runs / scorecardRunScale * 100}%` }} /></i><strong>{side.runs}<small>RUNS</small></strong></div><b>{side.wicketsLost}<small>WKTS LOST</small></b></div>)}</article><article className="extras-pressure-chart"><header><div><span>BOWLING DISCIPLINE</span><strong>Extras given away &amp; dot pressure</strong></div><small>Lower extras is better</small></header>{[scorecardHomeAnalysis, scorecardAwayAnalysis].map((side) => <div className="discipline-row" key={side.name}><span><b>{side.name}</b><small>{side.boundaries} boundaries faced · {side.wicketsTaken} wickets taken</small></span><strong>{side.extrasGiven}<small>EXTRAS</small></strong><div><i><em style={{ width: `${side.dotPressure}%` }} /></i><b>{side.dotPressure}%<small>DOT PRESSURE</small></b></div></div>)}</article></div></section>

          <details className="ball-by-ball-panel">
            <summary className="ball-by-ball-heading"><div><p className="overline">COMPLETE SCORECARD</p><h2>Ball-by-ball</h2><span>Every delivery, batter and bowler exactly as recorded on the source scorecard.</span></div><div className="ball-collapse-action"><span className="when-closed">Open full scorecard</span><span className="when-open">Close full scorecard</span><b>⌄</b></div></summary>
            <div className="ball-by-ball-controls"><div className="innings-tabs" role="tablist" aria-label="Choose batting innings">{scorecardMatch.innings?.map((inning) => <button type="button" role="tab" aria-selected={scorecardInnings?.id === inning.id} className={scorecardInnings?.id === inning.id ? "active" : ""} key={inning.id} onClick={() => setScorecardInningsNumber(inning.inningsNumber)}><small>INNINGS {inning.inningsNumber}</small><b>{inning.battingTeam}</b><strong>{inning.total}</strong></button>)}</div></div>
            {scorecardInnings ? <div className="innings-detail">
              <div className="innings-summary"><span><b>{scorecardInnings.battingTeam}</b> batting</span><strong>{scorecardInnings.total}<small>TOTAL</small></strong></div>
              <div className="pair-list">{scorecardInnings.pairs.map((pair) => <article className="batting-pair" key={pair.id}>
                <header><span>PAIR {pair.pairNumber}</span><div><b>{pair.batterOne}</b><i>+</i><b>{pair.batterTwo}</b></div><strong>{pair.total}<small>PAIR TOTAL</small></strong></header>
                <div className="over-grid">{pair.overs.map((over) => <section className="over-card" key={over.id}>
                  <div className="over-heading"><span><small>OVER</small><strong>{over.overNumber}</strong></span><div><small>BOWLER</small><b>{over.bowlerName}</b></div><em>{over.wickets}/{over.runs}<small>WKTS / RUNS</small></em></div>
                  <div className="delivery-sequence">{over.deliveries.map((delivery) => <div className="delivery" key={delivery.id} title={`${delivery.batterName}: ${delivery.outcome || "Dot ball"}`}><small>{isExtraOutcome(delivery.outcome) ? "EXTRA" : `BALL ${delivery.ballNumber}`}</small><strong className={deliveryTone(delivery.outcome)}>{delivery.outcome || "0"}</strong><span>{delivery.batterName}</span></div>)}</div>
                  <div className="over-batter-totals"><span><b>{pair.batterOne}</b><strong>{over.batterOneTotal}</strong></span><span><b>{pair.batterTwo}</b><strong>{over.batterTwoTotal}</strong></span></div>
                </section>)}</div>
              </article>)}</div>
              <div className="delivery-legend"><span><b className="dot">0</b> Empty / dot ball</span><span><b className="run">1–3</b> Runs</span><span><b className="boundary">4+</b> Boundary / high run ball</span><span><b className="wicket">C/B/R/S</b> Dismissal</span><span><b className="extra">W/N</b> Wide / no ball</span><span><b className="extra">LS</b> Legside</span><em>W means wide here—not wicket. Codes are kept exactly as recorded by Action Sport.</em></div>
            </div> : <div className="ball-by-ball-empty"><strong>No delivery data stored yet</strong><span>Upload the completed HTML scorecard again to import every ball.</span></div>}
          </details>

          <section className="team-comparison"><div className="section-title"><div><p className="overline">MATCH SHAPE</p><h2>Team comparison</h2></div><span>Calculated from every player row</span></div>{[
            { label: "Final score", home: scorecardMatch.homeScore, away: scorecardMatch.awayScore },
            { label: "Player runs", home: scorecardHome.reduce((sum, item) => sum + item.runs, 0), away: scorecardAway.reduce((sum, item) => sum + item.runs, 0) },
            { label: "Wickets taken", home: scorecardHome.reduce((sum, item) => sum + item.wickets, 0), away: scorecardAway.reduce((sum, item) => sum + item.wickets, 0) },
            { label: "Contribution", home: scorecardHome.reduce((sum, item) => sum + item.contribution, 0), away: scorecardAway.reduce((sum, item) => sum + item.contribution, 0) },
          ].map((metric) => { const scale = Math.max(Math.abs(metric.home), Math.abs(metric.away), 1); return <div className="comparison-row" key={metric.label}><strong>{metric.home}</strong><i><em style={{ width: `${Math.abs(metric.home) / scale * 100}%` }} /></i><span>{metric.label}</span><i><em style={{ width: `${Math.abs(metric.away) / scale * 100}%` }} /></i><strong>{metric.away}</strong></div>; })}<div className="comparison-teams"><span>{scorecardMatch.homeTeam}</span><span>{scorecardMatch.awayTeam}</span></div></section>

          {[{ name: scorecardMatch.homeTeam, score: scorecardMatch.homeScore, rows: scorecardHome }, { name: scorecardMatch.awayTeam, score: scorecardMatch.awayScore, rows: scorecardAway }].map((side) => <section className="full-stat-card" key={side.name}><div className="section-title"><div><p className="overline">FULL PLAYER STATISTICS</p><h2>{side.name}</h2></div><strong>{side.score}</strong></div><div className="mobile-scroll-hint">Swipe to compare every statistic →</div><div className="scorecard-stat-table"><div className="stat-head"><span>PLAYER</span><b>RUNS</b><b>SR</b><b>OVERS</b><b>RC</b><b>WKTS</b><b>ECON</b><strong>IMPACT</strong></div>{side.rows.map((item, index) => <div className="stat-row" key={item.id}><span><i>{index + 1}</i><Initials name={item.playerName} /><b>{item.playerName}</b></span><b>{item.runs}</b><b>{item.strikeRate}</b><b>{item.oversBowled}</b><b>{item.runsConceded}</b><b>{item.wickets}</b><b>{item.economy}</b><strong className={item.contribution >= 0 ? "positive" : "negative"}>{item.contribution}</strong></div>)}</div><div className="stat-legend"><span><b>SR</b> Strike rate</span><span><b>RC</b> Runs conceded</span><span><b>ECON</b> Economy</span><span><b>IMPACT</b> Total contribution</span></div></section>)}

        </>}

        {view === "performance" && <>
          <section className="season-context-bar">
            <div><p className="overline">TEAM STATS VIEW</p><h2>Choose the season and matches to analyse</h2><span>Every chart and headline number below updates with these choices.</span></div>
            <div className="season-context-controls">
              <label><span>Season</span>{team?.seasons?.length ? <select aria-label="Choose team statistics season" value={teamStatsAllTime ? "all" : (season?.id ?? "")} onChange={(event) => { const value = event.target.value; if (value === "all") { setTeamStatsAllTime(true); } else { setTeamStatsAllTime(false); setSelectedSeasonId(Number(value)); } }}><option value="all">All-time (every season)</option>{team.seasons.map((item) => <option key={item.id} value={item.id}>{item.name || `Season ${item.externalSeasonId}`}</option>)}</select> : <b>Current season</b>}</label>
              <label><span>Game type</span><select aria-label="Filter team statistics by game type" value={teamStatsMatchFilter} onChange={(event) => setTeamStatsMatchFilter(event.target.value as TeamStatsMatchFilter)}><option value="all">All game types</option><option value="league">League</option><option value="friendly">Friendly</option><option value="grading">Grading</option></select></label>
              <label><span>Result</span><select aria-label="Filter team statistics by result" value={teamStatsResultFilter} onChange={(event) => setTeamStatsResultFilter(event.target.value as TeamStatsResultFilter)}><option value="all">All results</option><option value="win">Wins</option><option value="loss">Losses</option><option value="draw">Draws</option></select></label>
              <label><span>Chart order</span><select aria-label="Sort team statistics matches" value={teamStatsSort} onChange={(event) => setTeamStatsSort(event.target.value as TeamStatsSort)}><option value="oldest">Oldest to newest</option><option value="newest">Newest to oldest</option></select></label>
            </div>
            <strong>{teamStatsActivities.length}<small>of {teamStatsAllTime ? teamActivities.length : seasonActivities.length} scorecards</small></strong>
          </section>
          <section className="team-stats-hero">
            <span className="team-stats-rings" aria-hidden="true" />
            <header><div className="team-stats-team"><Initials name={team?.name ?? "ActionHQ"} large src={team?.imageUrl ?? null} /><span><small>TEAM STATISTICS</small><strong>{team?.name ?? "Your team"}</strong><em>{season?.leagueName ?? "Action Cricket"}</em></span></div><div className="season-current-pill"><span>VIEWING</span><strong>{teamStatsAllTime ? "All-time" : (season?.name || "Current season")}</strong></div></header>
            <div className="team-stats-kpis"><article><span>GAMES</span><strong>{teamStatsSummary.games}</strong></article><article className="positive"><span>RECORD</span><strong>{teamStatsSummary.wins}–{teamStatsSummary.losses}</strong><small>{teamStatsSummary.draws} draw{teamStatsSummary.draws === 1 ? "" : "s"}</small></article><article><span>AVG SCORED</span><strong>{teamStatsSummary.averageScored}</strong></article><article className={teamStatsRunDifference >= 0 ? "positive" : "negative"}><span>RUN DIFFERENCE</span><strong>{teamStatsRunDifference > 0 ? "+" : ""}{teamStatsRunDifference}</strong><small>{teamStatsSummary.averageConceded} conceded / game</small></article></div>
            <footer><div className="team-stats-form"><span>FILTERED FORM</span><div>{teamStatsForm.length ? teamStatsForm.map((result, index) => <b className={result.toLowerCase()} key={`${result}-${index}`}>{result}</b>) : <small>No games match these filters</small>}</div></div><div><button onClick={() => navigateTo("leaderboards")}>Open player rankings</button><button onClick={() => navigateTo("players")}>Player profiles</button></div></footer>
          </section>
          {team ? <><TeamPerformanceCharts teamName={team.name} matches={teamStatsActivities} sortOrder={teamStatsSort} /></> : loading ? <section className="ranking-empty"><span>↗</span><h2>Loading team statistics…</h2><p>One moment while we load the Die Bron record.</p></section> : <section className="ranking-empty"><span>↗</span><h2>Team statistics are unavailable</h2><p>The Die Bron team record could not be loaded. Restore the team data to unlock its charts.</p><button onClick={() => navigateTo("team")}>Open Team Admin</button></section>}
        </>}

        {view === "team" && <>
          <div className="page-intro"><div><p className="overline">TEAM ADMINISTRATION</p><h1>{team?.name ?? "Die Bron"}</h1><p>Import completed games first, then manage the season, official roster and stored results for this team.</p></div></div>
          {team && <section className="team-image-card"><Initials name={team.name} large src={team.imageUrl} /><div><strong>{team.name}</strong><small>Team profile image</small></div><div className="avatar-upload"><label className="avatar-upload-button">{team.imageUrl ? "Change image" : "Upload image"}<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; try { await saveTeamImage(await readImageThumbnail(file)); } catch { setNotice("Could not read that image."); } }} /></label>{team.imageUrl && <button type="button" className="avatar-remove" disabled={working === "account"} onClick={() => saveTeamImage(null)}>Remove</button>}</div></section>}
          {team && scorecardImportSeason && <form id="scorecard-imports" className="quick-sync-card team-admin-import team-admin-import-top file-upload-card" onSubmit={uploadMatches}>
            <div className="sync-symbol">⇧</div>
            <div><p className="overline">QUICK ACTION · UPDATE SCORES</p><strong>Import completed scorecards</strong><span>Choose the destination season first, then upload saved HTML files.</span></div>
            <div className="scorecard-import-control">
              <label className="scorecard-season-picker"><span>Save scorecards to season</span><select aria-label="Choose scorecard import season" value={scorecardImportSeason.id} onChange={(event) => setScorecardSeasonId(Number(event.target.value))}>{team.seasons.map((item) => <option key={item.id} value={item.id}>{item.name || `Season ${item.externalSeasonId}`} · {item.leagueName || "League not named"}{item.isCurrent ? " · Current" : ""}</option>)}</select><small>All team and player statistics will be filed under this season.</small></label>
              <fieldset className="match-type-checks"><legend>Game type</legend><label className={scorecardMatchType === "friendly" ? "selected" : ""}><input type="checkbox" checked={scorecardMatchType === "friendly"} onChange={(event) => setScorecardMatchType(event.target.checked ? "friendly" : "league")} />Friendly game</label><label className={scorecardMatchType === "grading" ? "selected" : ""}><input type="checkbox" checked={scorecardMatchType === "grading"} onChange={(event) => setScorecardMatchType(event.target.checked ? "grading" : "league")} />Grading game</label><small>Leave both clear for a league game.</small></fieldset>
              <label className="scorecard-file-picker"><input key={uploadInputKey} aria-label="Completed HTML scorecards" type="file" accept=".html,.htm,text/html" multiple required onChange={(event) => setScorecardFiles(Array.from(event.target.files ?? []))} /><span>{scorecardFiles.length ? `${scorecardFiles.length} scorecard${scorecardFiles.length === 1 ? "" : "s"} selected` : "Choose HTML files"}</span></label>
            </div>
            {scorecardImportFeedback && <div className={`scorecard-import-feedback ${scorecardImportFeedback.tone}`} role={scorecardImportFeedback.tone === "error" ? "alert" : "status"}><b>{scorecardImportFeedback.tone === "error" ? "Import failed" : "Import complete"}</b><span>{scorecardImportFeedback.message}</span></div>}
            <button disabled={working === "match"}>{working === "match" ? "Importing…" : `Import to ${scorecardImportSeason.name || `Season ${scorecardImportSeason.externalSeasonId}`}`}</button>
          </form>}
          {!team && !loading && <section className="ranking-empty"><span>!</span><h2>Die Bron data is unavailable</h2><p>The portal is configured for one team. Restore the team record before managing seasons or importing scorecards.</p></section>}
          {team && <>
            <section id="season-management" className="season-command-center">
              <div className="season-command-head"><div><p className="overline">SEASON WORKSPACE</p><h2>{season?.name || `Season ${season?.externalSeasonId ?? "not added"}`}</h2><p>{season ? `${season.leagueName || "League not named"} · Season ID ${season.externalSeasonId}. ` : ""}{season?.id === currentSeason?.id ? "New scorecards will be filed here automatically." : "This archived season is read-only until you make it current."}</p></div>{season && <span className={`current-season-badge${season.id === currentSeason?.id ? "" : " archived"}`}>{season.id === currentSeason?.id ? "CURRENT" : "ARCHIVED"}</span>}</div>
              {!!team.seasons?.length && <div className="season-switcher"><div><p className="overline">CHOOSE SEASON</p><strong>{team.seasons.length} season{team.seasons.length === 1 ? "" : "s"} safely stored</strong></div><label>Viewing<select value={season?.id ?? ""} onChange={(event) => setSelectedSeasonId(Number(event.target.value))}>{team.seasons.map((item) => <option key={item.id} value={item.id}>{item.name || `Season ${item.externalSeasonId}`} · {item.leagueName || `League ${item.externalSeasonId}`}{item.id === currentSeason?.id ? " · Current" : " · Archived"}</option>)}</select></label>{season && season.id !== currentSeason?.id && <button className="make-current-button" disabled={working === "season"} onClick={() => makeSeasonCurrent(season.id)}>Make current</button>}</div>}
              <nav className="season-flow" aria-label="Season management sections">
                <button type="button" onClick={() => openTeamSection("scorecard-imports")}><b>1</b><span>Import<small>{currentSeason?.name || "Current season"}</small></span></button>
                <button type="button" onClick={() => openTeamSection("season-management")}><b>2</b><span>Season<small>{season?.id === currentSeason?.id ? "Current" : "Archived"}</small></span></button>
                <button type="button" onClick={() => openTeamSection("season-roster")}><b>3</b><span>Roster<small>{activeRosterPlayers.length ? `${activeRosterPlayers.length} active players` : "Needs roster"}</small></span></button>
                <button type="button" onClick={() => openTeamSection("season-results")}><b>4</b><span>Results<small>{seasonActivities.length} scorecards</small></span></button>
              </nav>
              <div className="season-settings-grid">
                <details className="season-add-panel"><summary><span>＋</span><div><strong>Add a new season</strong><small>Create the next league season and optionally import its official roster.</small></div><em>Open</em></summary><form className="season-create-form" onSubmit={addSeason}><label>Season name<input required value={newSeasonName} onChange={(event) => setNewSeasonName(event.target.value)} placeholder="Winter 2026" /></label><label>League<input required value={newSeasonLeague} onChange={(event) => setNewSeasonLeague(event.target.value)} placeholder="Men's A League" /></label><label>Season ID<input required value={newSeasonExternalId} onChange={(event) => setNewSeasonExternalId(event.target.value)} placeholder="7889" /></label><label className="season-source-field">Official team profile URL <small>Optional</small><input type="url" value={teamUrl} onChange={(event) => setTeamUrl(event.target.value)} placeholder="Paste only if you want to import the roster" /></label><button disabled={working === "season"}>{working === "season" ? "Adding season…" : "Add season & make current"}</button><p>Without a profile URL, the season starts empty. You can still import completed scorecards.</p></form></details>
                {season && <details className="season-add-panel season-edit-panel"><summary><span>✎</span><div><strong>Edit selected season</strong><small>Rename, correct its league or Season ID, or delete an empty season.</small></div><em>Open</em></summary><form key={season.id} className="season-edit-form" onSubmit={(event) => editSeason(event, season.id)}><label>Season name<input required name="seasonName" defaultValue={season.name || `Season ${season.externalSeasonId}`} /></label><label>League<input required name="leagueName" defaultValue={season.leagueName || `League ${season.externalSeasonId}`} /></label><label>Season ID<input required name="externalSeasonId" defaultValue={season.externalSeasonId} /></label><button disabled={working === "season"}>Save changes</button><button type="button" className="delete-season-button" disabled={working === "season"} onClick={() => deleteSeason(season)}>Delete season</button></form></details>}
              </div>
            </section>
            <div className="team-summary"><article><small>Completed games</small><strong>{seasonTeamSummary.games}</strong></article><article><small>Scorecard record</small><strong>{seasonTeamSummary.wins}–{seasonTeamSummary.losses}–{seasonTeamSummary.draws}</strong></article><article><small>Avg scored</small><strong>{seasonTeamSummary.averageScored}</strong></article><article><small>Active squad</small><strong>{activeRosterPlayers.length}</strong></article></div>
            <section id="season-roster" className="squad-panel">
              <div className="section-title"><div><p className="overline">3 · CONFIRM ROSTER · {season?.name?.toUpperCase() || "CURRENT SEASON"}</p><h2>Player profiles and history</h2><p>Remove players from this season&apos;s active roster without deleting their permanent profile or completed match history.</p></div><span>{activeRosterPlayers.length ? `${activeRosterPlayers.length} active roster player${activeRosterPlayers.length === 1 ? "" : "s"}` : "No active roster players"}</span></div>
              {players.length ? <div className="squad-list">{players.map((player) => { const matchLinked = (player.linkedAppearances ?? 0) > 0; const profileId = player.linkedOwnerId ?? player.playerProfileId ?? 0; const profileImage = directoryProfiles.find((entry) => entry.id === profileId)?.imageUrl ?? profiles.find((entry) => entry.id === profileId)?.imageUrl ?? null; return <div key={player.id}><Initials name={player.name} src={profileImage} /><span><b>{player.name}</b><small>{player.games} games · {player.runs} runs · {player.wickets} wickets · {player.linkedAppearances ?? 0} scorecards</small></span><em className={player.active === false ? "former" : matchLinked ? "claimed" : ""}>{player.active === false ? "FORMER" : matchLinked ? "MATCH HISTORY" : "ROSTER"}</em><span className="squad-actions"><label className="roster-photo-button">{profileImage ? "Change photo" : "Add photo"}<input type="file" accept="image/*" disabled={!profileId} onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file || !profileId) return; try { await savePlayerImage(profileId, await readImageThumbnail(file)); } catch { setNotice("Could not read that image."); } }} /></label><button onClick={() => openPublicPlayer(profileId)}>View profile</button>{season?.id === currentSeason?.id && <button className={player.active === false ? "roster-restore-button" : "roster-remove-button"} disabled={working === "season"} onClick={() => setRosterPlayerActive(player, player.active === false)}>{player.active === false ? "Restore" : "Remove from roster"}</button>}</span></div>; })}</div> : season?.id === currentSeason?.id ? <form className="roster-import-empty" onSubmit={importSeasonRoster}><div><strong>Import the official roster</strong><p>Paste this season&apos;s Action Sport Team Profile URL. Only player names are imported; all statistics stay at zero until scorecards are added.</p></div><label>Team Profile URL<input required type="url" value={teamUrl} onChange={(event) => setTeamUrl(event.target.value)} placeholder="https://actionsport.spawtz.com/Leagues/TeamProfile?..." /></label><button disabled={working === "season"}>{working === "season" ? "Importing…" : "Import roster"}</button></form> : <div className="panel-empty">No roster was stored for this archived season. Make it current if you need to import its official roster.</div>}
              {!!archivedRosterPlayers.length && <details className="removed-roster-panel"><summary><span>Removed roster players</span><b>{archivedRosterPlayers.length}</b></summary><p>These players have no scorecard history in this season and are hidden from player pages and rankings.</p><div>{archivedRosterPlayers.map((player) => <article key={player.id}><Initials name={player.name} /><span><b>{player.name}</b><small>Permanent profile preserved · 0 games</small></span>{season?.id === currentSeason?.id && <button className="roster-restore-button" disabled={working === "season"} onClick={() => setRosterPlayerActive(player, true)}>Restore</button>}</article>)}</div></details>}
            </section>
            {season?.id !== currentSeason?.id && <div className="archived-season-note"><span>ARCHIVED SEASON</span><strong>{season?.name || "This season"} is protected.</strong><p>You can review its roster and completed games below. Make it current only if you need to import another scorecard.</p></div>}
            <section id="season-results" className="season-game-manager"><div className="section-title"><div><p className="overline">4 · SEASON GAMES</p><h2>Completed scorecards</h2></div><span>{seasonActivities.length} linked to {season?.name || "the selected season"}</span></div>{seasonActivities.length ? seasonActivities.map((match) => <div className="season-game-row" key={match.id}><button onClick={() => openScorecard(match.id)}><span>{matchTypeLabel(match.matchType)} · Fixture {match.fixtureId}</span><b>{match.homeTeam} {match.homeScore}–{match.awayScore} {match.awayTeam}</b><small>{match.playedAt}</small></button><label>Move to<select value={match.teamSeasonId ?? currentSeason?.id ?? ""} disabled={working === "season"} onChange={(event) => moveMatchToSeason(match.id, Number(event.target.value))}>{team.seasons.map((item) => <option key={item.id} value={item.id}>{item.name || `Season ${item.externalSeasonId}`}</option>)}</select></label></div>) : <div className="panel-empty">No completed scorecards linked to this season yet.</div>}</section>
          </>}
        </>}

        {view === "players" && <>
          <div className="page-intro"><div><p className="overline">PLAYER DIRECTORY</p><h1>Every {team?.name ?? "team"} player has a page.</h1></div></div>
          <section className="season-context-bar player-directory-context"><div><p className="overline">PLAYER STATS VIEW</p><h2>Choose all-time or one season</h2></div><div className="season-context-controls"><label><span>Season</span><select aria-label="Choose player directory season" value={playerDirectorySeasonFilter} onChange={(event) => { const value = event.target.value; setPlayerDirectorySeasonFilter(value); if (value !== "all") setSelectedSeasonId(Number(value)); }}><option value="all">All-time career</option>{team?.seasons.map((item) => <option key={item.id} value={String(item.id)}>{item.name || `Season ${item.externalSeasonId}`}</option>)}</select></label><label><span>Sort players</span><select aria-label="Sort player directory" value={playerDirectorySort} onChange={(event) => setPlayerDirectorySort(event.target.value as PlayerDirectorySort)}><option value="name">Name A–Z</option><option value="games">Most games</option><option value="runs">Most runs</option><option value="wickets">Most wickets</option><option value="impact">Highest impact</option></select></label></div><strong>{playerDirectoryRows.length}<small>players shown</small></strong></section>
          
          {!!playerDirectoryRows.length && <section className="profile-link-status"><span>✓</span><div><strong>{playerDirectoryRows.length} player profile{playerDirectoryRows.length === 1 ? " is" : "s are"} available in this view</strong><p>Every roster player has the same permanent profile, with scorecard history connected automatically.</p></div></section>}
          <div className="player-directory-grid">{playerDirectoryRows.map((item) => { const stats = directoryStatsFor(item); const viewName = playerDirectorySeasonFilter === "all" ? "ALL TIME" : (seasonNames[Number(playerDirectorySeasonFilter)] ?? "SELECTED SEASON").toUpperCase(); return <button className="player-directory-card" key={item.id} onClick={() => openPublicPlayer(item.id)}><div className="directory-card-head"><Initials name={item.displayName} large src={item.imageUrl} /><span><em>PLAYER PROFILE · {viewName}</em><strong>{item.displayName}</strong><small>{item.seasons[0]?.teamName ?? team?.name ?? "Action Cricket"} · permanent career profile</small></span></div><div className="directory-stats"><span><b>{stats.games}</b><small>GAMES</small></span><span><b>{stats.runs}</b><small>RUNS</small></span><span><b>{stats.wickets}</b><small>WKTS</small></span><span><b>{stats.scorecards}</b><small>SCORECARDS</small></span></div><div className="directory-card-foot"><span>{stats.scorecards ? `${viewName.toLowerCase()} match history connected` : "Waiting for first scorecard in this view"}</span><b>View full profile →</b></div></button>; })}</div>
        </>}

        {view === "fixtures" && <>
          <div className="page-intro"><div><p className="overline">MATCH CENTRE</p><h1>Games &amp; scorecards</h1><p>Open every completed result and full scorecard from one page.</p></div><button className="primary-action" onClick={() => openTeamSection("scorecard-imports")}>Update scores</button></div>
          <section className="recent-results"><div className="section-title"><div><p className="overline">COMPLETED</p><h2>Recent scorecards</h2></div><span>{teamActivities.length} imported</span></div>{teamActivities.map((match) => <div className="recent-result-row" key={match.id}><button onClick={() => openScorecard(match.id)}><span>{matchTypeLabel(match.matchType)} · {match.playedAt}</span><b>{match.homeTeam} {match.homeScore}–{match.awayScore} {match.awayTeam}</b><em>View scorecard →</em></button>{canManageTeam && <button className="remove-game" disabled={working === "remove"} onClick={() => removeMatch(match)} aria-label={`Remove Fixture ${match.fixtureId}`}>Remove</button>}</div>)}</section>
        </>}

        {view === "search" && <>
          <div className="page-intro"><div><p className="overline">SEARCH ACTIONHQ</p><h1>Find your cricket circle.</h1><p>Search every player page, connected team and uploaded scorecard.</p></div></div>
          <div className="mobile-search"><span>⌕</span><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Type a player, team or fixture ID" /></div>
          {!searchQuery.trim() ? <div className="search-empty"><span>⌕</span><h2>Start with a name or Fixture ID</h2><p>Your results will appear here as you type.</p></div> : <div className="search-sections">
            <section><div className="section-title"><div><p className="overline">PLAYER PAGES</p><h2>{searchResults.players.length} found</h2></div></div>{searchResults.players.map((item) => <div className="search-result" key={item.id}><Initials name={item.displayName} src={item.imageUrl} /><span><b>{item.displayName}</b><small>{item.allTime.games} games · {item.allTime.runs} runs · {item.allTime.linkedMatches} scorecards</small></span><button onClick={() => openPublicPlayer(item.id)}>View profile</button>{item.registeredAt && profile?.id !== item.id && <button className={followingIds.has(item.id) ? "following" : ""} onClick={() => toggleFollow(item.id)}>{followingIds.has(item.id) ? "Following" : "Follow"}</button>}</div>)}</section>
            <section><div className="section-title"><div><p className="overline">TEAM</p><h2>{searchResults.teams.length} found</h2></div></div>{searchResults.teams.map((item) => <button className="search-result team-result" key={item.id} onClick={() => navigateTo("team")}><Initials name={item.name} /><span><b>{item.name}</b><small>{item.seasons.length} stored seasons · Last synced {new Date(item.lastSyncedAt).toLocaleDateString("en-ZA")}</small></span><em>Open Team Admin →</em></button>)}</section>
            <section><div className="section-title"><div><p className="overline">MATCHES</p><h2>{searchResults.matches.length} found</h2></div></div>{searchResults.matches.map((item) => <button className="search-result team-result" key={item.id} onClick={() => openScorecard(item.id)}><span className="fixture-icon">#{item.fixtureId}</span><span><b>{item.homeTeam} {item.homeScore}–{item.awayScore} {item.awayTeam}</b><small>{matchTypeLabel(item.matchType)} · {item.playedAt} · {item.performances.length} player performances</small></span><em>View scorecard →</em></button>)}</section>
          </div>}
        </>}

        {view === "player" && viewedProfile && <>
          <button className="back-link" onClick={() => navigateTo("players")}>← All player pages</button>
          <PlayerPerformanceCharts player={viewedProfile} activities={activities} seasonFilter={playerSeasonFilter} onSeasonFilterChange={setPlayerSeasonFilter} seasonNames={seasonNames} />
          {profile?.id === viewedProfile.id && <form className="filler-card" onSubmit={(event) => { event.preventDefault(); linkFillerAppearance(); }}><div><p className="overline">PLAYED AS A FILLER?</p><h2>Add the match to this profile</h2><p>Import the scorecard under Team Admin first, then enter its Fixture ID here. ActionHQ matches the player name without fetching external data.</p></div><label>Fixture ID<input required inputMode="numeric" pattern="[0-9]+" value={fillerFixtureId} onChange={(event) => setFillerFixtureId(event.target.value)} /></label><button disabled={working === "filler"}>{working === "filler" ? "Adding…" : "Add appearance"}</button></form>}
          {!!scorecardCandidates.length && profile?.id === viewedProfile.id && <div className="candidate-card"><strong>Choose the matching scorecard name</strong><p>This is needed only when the scorecard used a different player name.</p><div>{scorecardCandidates.map((candidate) => <button key={`${candidate.teamName}-${candidate.name}`} onClick={() => linkFillerAppearance(candidate.name)}><Initials name={candidate.name} /><span><b>{candidate.name}</b><small>{candidate.teamName}</small></span>＋</button>)}</div></div>}
          <section className="history-panel"><div className="section-title"><div><p className="overline">CLUB HISTORY</p><h2>Seasons and teams</h2></div></div>{viewedProfile.seasons.length ? viewedProfile.seasons.map((item) => <div className="history-row" key={item.id}><Initials name={item.teamName} src={team && item.teamName.toLowerCase() === team.name.toLowerCase() ? team.imageUrl : null} /><span><b>{item.teamName}</b></span><strong>{item.games}<small>GAMES</small></strong><strong>{item.runs}<small>RUNS</small></strong><strong>{item.wickets}<small>WKTS</small></strong></div>) : <div className="panel-empty">No connected team seasons yet.</div>}</section>
          <section className="history-panel"><div className="section-title"><div><p className="overline">MATCH HISTORY</p><h2>{playerSeasonFilter === "all" ? "Every linked appearance" : "Selected season appearances"}</h2></div><span>{viewedProfileMatches.length} scorecards</span></div>{viewedProfileMatches.length ? viewedProfileMatches.map((item) => <button type="button" className="history-row" key={item.claimId} onClick={() => { const match = activities.find((activity) => activity.fixtureId === item.fixtureId); if (match) openScorecard(match.id); }}><Initials name={item.teamName} /><span><b>{item.homeTeam} {item.homeScore}–{item.awayScore} {item.awayTeam}</b></span><strong>{item.runs}<small>RUNS</small></strong><strong>{item.wickets}<small>WKTS</small></strong><strong>{item.contribution}<small>IMPACT</small></strong></button>) : <div className="panel-empty">No linked scorecards in this season yet.</div>}</section>
        </>}

        {view === "account" && <>
          <button className="back-link" onClick={() => profile ? openPublicPlayer(profile.id) : navigateTo("players")}>← Back to player profile</button>
          <div className="page-intro"><div><p className="overline">PROFILE SETTINGS</p><h1>{profile ? "Update player details." : "Team profile settings"}</h1><p>Contact details stay private. Cricket statistics continue to come from the team roster and uploaded scorecards.</p></div></div>
          {!profile ? <button className="primary-action" onClick={() => navigateTo("players")}>Open team player profiles</button> : <form className="account-form" onSubmit={saveAccount}><div className="account-avatar"><Initials name={accountName || profile.displayName} large src={accountImage} /><span><b>{profile.displayName}</b><small>Player record #{profile.id}</small></span><div className="avatar-upload"><label className="avatar-upload-button">{accountImage ? "Change photo" : "Upload photo"}<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; try { setAccountImage(await readImageThumbnail(file)); setNotice("Photo ready — press Save profile to keep it."); } catch { setNotice("Could not read that image."); } }} /></label>{accountImage && <button type="button" className="avatar-remove" onClick={() => setAccountImage(null)}>Remove</button>}</div></div><div className="form-grid"><label>Display name<input required value={accountName} onChange={(event) => setAccountName(event.target.value)} /></label><label>Email<input type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} /></label><label>Phone<input value={accountPhone} onChange={(event) => setAccountPhone(event.target.value)} placeholder="+27" /></label><label>Playing role<select value={accountRole} onChange={(event) => setAccountRole(event.target.value)}><option>All-rounder</option><option>Batter</option><option>Bowler</option><option>Wicketkeeper</option></select></label><label className="wide">Preferred venue<input value={accountVenue} onChange={(event) => setAccountVenue(event.target.value)} /></label><label className="wide">Bio<textarea maxLength={280} value={accountBio} onChange={(event) => setAccountBio(event.target.value)} placeholder="Tell teammates about your indoor cricket journey." /></label></div><button disabled={working === "account"}>{working === "account" ? "Saving…" : "Save profile"}</button></form>}
          {profile && <section className="account-status"><div><span>PLAYER RECORD</span><strong>Statistics stay connected</strong><p>Imported team records stay untouched while profile details can be updated safely.</p></div><div><span>DATA STATUS</span><strong>Permanent history active</strong><p>{profile.allTime.seasons} seasons and {profile.allTime.linkedMatches} scorecards connected, including {profile.allTime.fillerMatches} filler matches.</p></div></section>}
        </>}

        {view === "privacy" && <>
          <button className="back-link" onClick={() => navigateTo("feed")}>← Back to home</button>
          <div className="page-intro"><div><p className="overline">TRUST & SUPPORT</p><h1>Your stats, handled clearly.</h1><p>How ActionHQ treats imported scorecards and player-owned records.</p></div></div><section className="policy-grid"><article><span>01</span><h2>Scorecards are the source</h2><p>Team Profile links import player names only. Runs, wickets, records and averages are calculated exclusively from completed scorecards.</p></article><article><span>02</span><h2>Player ownership</h2><p>Imported records are never deleted when a player changes teams. Every synced roster identity keeps its permanent history.</p></article><article><span>03</span><h2>POPIA-minded design</h2><p>Email and phone details remain private and are never displayed on public player profiles.</p></article><article><span>04</span><h2>Manual score updates</h2><p>Match data enters ActionHQ only when a saved HTML scorecard is uploaded or an Action Sport scorecard URL is pasted. Nothing is fetched automatically.</p></article></section><div className="support-card"><div><p className="overline">NEED HELP?</p><h2>Start with Team Admin</h2><p>Import the corrected scorecard again using either method. If the scorecard is right but the identity is wrong, leave the match untouched and review the profile link.</p></div><button onClick={() => navigateTo("team")}>Open scorecard imports</button></div>
        </>}

        {view === "leaderboards" && <>
          <section className="rankings-hero">
            <span className="rankings-hero-rings" aria-hidden="true" />
            <header><div className="rankings-team-id"><Initials name={team?.name ?? "ActionHQ"} /><span><small>TEAM &amp; PLAYER INTELLIGENCE</small><strong>{team?.name ?? "Your team"}</strong></span></div><label className="rankings-season-select"><span>VIEWING SEASON</span>{team?.seasons?.length ? <select aria-label="Choose ranking season" value={rankingAllTime ? "all" : (season?.id ?? "")} onChange={(event) => { const value = event.target.value; if (value === "all") { setRankingAllTime(true); } else { setRankingAllTime(false); setSelectedSeasonId(Number(value)); } }}><option value="all">All-time (every season)</option>{team.seasons.map((item) => <option key={item.id} value={item.id}>{item.name || `Season ${item.externalSeasonId}`}</option>)}</select> : <b>Current season</b>}</label></header>
            <div className="rankings-hero-copy"><p>SEASON PERFORMANCE BOARD</p><h1>Find what wins matches.</h1><span>Rank every player from uploaded scorecards, then move beyond totals into batting habits, wicket pressure and team patterns.</span></div>
            <div className="rankings-season-kpis"><article><span>PLAYERS</span><strong>{rankingPlayers.length}</strong><small>{rankingAllTime ? "across every season" : "on this season roster"}</small></article><article><span>SCORECARDS</span><strong>{rankingAllTime ? teamActivities.length : seasonActivities.length}</strong><small>verified results</small></article><article className="positive"><span>RECORD</span><strong>{seasonTeamSummary.wins}–{seasonTeamSummary.losses}</strong><small>{seasonTeamSummary.draws} draw{seasonTeamSummary.draws === 1 ? "" : "s"}</small></article><article><span>AVG SCORE</span><strong>{seasonTeamSummary.averageScored}</strong><small>{seasonTeamSummary.averageConceded} conceded</small></article></div>
          </section>

          {rankingPlayers.length ? <>
            <section className="ranking-leader-strip" aria-label="Season category leaders">
              {[
                { label: "Impact leader", player: rankingPlayers[0], value: rankingPlayers[0] ? rankingMetricDisplay(rankingPlayers[0], "impact") : "—", unit: "CONTRIBUTION", tone: "impact" },
                { label: "Top scorer", player: rankingTopRuns, value: String(rankingTopRuns?.runs ?? 0), unit: "RUNS", tone: "runs" },
                { label: "Wicket leader", player: rankingTopWickets, value: String(rankingTopWickets?.wickets ?? 0), unit: "WICKETS", tone: "wickets" },
                { label: "Best average", player: topRunsAverage ?? topStrikeRate, value: String(topRunsAverage?.runsAverage ?? 0), unit: "RUNS / GAME", tone: "average" },
              ].map((leader) => <button key={leader.label} className={leader.tone} onClick={() => { const target = leader.player?.linkedOwnerId ?? leader.player?.playerProfileId; if (target) openPublicPlayer(target); }} disabled={!leader.player}><span>{leader.label}</span><div>{leader.player && <Initials name={leader.player.name} />}<b>{leader.player?.name ?? "No player data"}</b></div><strong>{leader.value}<small>{leader.unit}</small></strong></button>)}
            </section>

            <section className="ranking-board-card">
              <header className="ranking-board-heading"><div><p className="overline">LIVE LEADERBOARD</p><h2>Choose what matters</h2></div><button className="outline-button" onClick={() => navigateTo("players")}>View player profiles</button></header>
              <div className="ranking-metric-select"><label><span>Rank by</span><select aria-label="Choose leaderboard metric" value={rankingMetric} onChange={(event) => setRankingMetric(event.target.value as RankingMetric)}>{rankingMetricOptions.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>)}</select></label></div>
              <div className="ranking-focus-line"><span><b>{activeRankingMetric.label}</b><small>{activeRankingMetric.description}</small></span><em>{rankedPlayers.length} players ranked</em></div>
              <div className="ranking-podium">
                {rankedPlayers[0] && <button className="ranking-champion" onClick={() => { const target = rankedPlayers[0].linkedOwnerId ?? rankedPlayers[0].playerProfileId; if (target) openPublicPlayer(target); }}><span className="ranking-place">01</span><Initials name={rankedPlayers[0].name} large /><div><small>SEASON LEADER · {activeRankingMetric.short}</small><strong>{rankedPlayers[0].name}</strong><p>{rankedPlayers[0].games} games · {rankedPlayers[0].runs} runs · {rankedPlayers[0].wickets} wickets</p></div><b>{rankingMetricDisplay(rankedPlayers[0], rankingMetric)}<small>{activeRankingMetric.label}</small></b></button>}
                <div className="ranking-chasers">{rankedPlayers.slice(1, 3).map((player, index) => <button key={player.id} onClick={() => { const target = player.linkedOwnerId ?? player.playerProfileId; if (target) openPublicPlayer(target); }}><span className="ranking-place">0{index + 2}</span><Initials name={player.name} /><div><strong>{player.name}</strong><small>{player.games} games · {player.runs} runs · {player.wickets} wickets</small><i><em style={{ width: `${Math.max(4, Math.abs(rankingMetricValue(player, rankingMetric)) / rankingPeak * 100)}%` }} /></i></div><b>{rankingMetricDisplay(player, rankingMetric)}</b></button>)}</div>
              </div>
            </section>

            <section className="ranking-table-card">
              <header><div><p className="overline">COMPLETE TEAM BOARD</p><h2>Every player, one clear comparison</h2><span>Search, filter and sort the season roster without changing the podium above.</span></div><span>Tap any name to open the permanent player profile</span></header>
              <div className="ranking-table-toolbar" aria-label="Filter and sort team board">
                <label className="ranking-player-search"><span>Find player</span><div><i>⌕</i><input aria-label="Search team board players" value={rankingSearch} onChange={(event) => setRankingSearch(event.target.value)} placeholder="Search by player name" /></div></label>
                <label><span>Show players</span><select aria-label="Filter team board participation" value={rankingParticipationFilter} onChange={(event) => setRankingParticipationFilter(event.target.value as RankingParticipationFilter)}><option value="all">All players</option><option value="played">With scorecards</option><option value="waiting">Awaiting scorecard</option></select></label>
                <label><span>Sort by</span><select aria-label="Sort team board" value={rankingTableSort} onChange={(event) => { const sort = event.target.value as RankingTableSort; setRankingTableSort(sort); setRankingSortDirection(sort === "name" ? "asc" : "desc"); }}><option value="impact">Contribution</option><option value="runs">Runs</option><option value="runsAverage">Runs average</option><option value="strikeRate">Strike rate</option><option value="wickets">Wickets</option><option value="games">Games</option><option value="name">Player name</option></select></label>
                <button className="ranking-sort-direction" onClick={() => setRankingSortDirection((current) => current === "desc" ? "asc" : "desc")} aria-label={rankingSortDirection === "desc" ? "Change to ascending order" : "Change to descending order"}><b>{rankingSortDirection === "desc" ? "↓" : "↑"}</b><span>{rankingTableSort === "name" ? rankingSortDirection === "asc" ? "A to Z" : "Z to A" : rankingSortDirection === "desc" ? "High to low" : "Low to high"}</span></button>
              </div>
              <div className="ranking-table-status"><span><b>{rankingTablePlayers.length}</b> of {rankingPlayers.length} players shown</span>{rankingFiltersActive && <button onClick={resetRankingTable}>Reset board</button>}</div>
              <div className="mobile-scroll-hint">Player names stay visible while you swipe across statistics →</div>
              <div className="ranking-table-scroll"><table><thead><tr><th>Rank</th><th className={rankingTableSort === "name" ? "active" : ""}><button onClick={() => chooseRankingTableSort("name")}>Player <i>{rankingTableSort === "name" ? rankingSortDirection === "asc" ? "↑" : "↓" : ""}</i></button></th><th className={rankingTableSort === "games" ? "active" : ""}><button onClick={() => chooseRankingTableSort("games")}>G <i>{rankingTableSort === "games" ? rankingSortDirection === "asc" ? "↑" : "↓" : ""}</i></button></th><th className={rankingTableSort === "runs" ? "active" : ""}><button onClick={() => chooseRankingTableSort("runs")}>R <i>{rankingTableSort === "runs" ? rankingSortDirection === "asc" ? "↑" : "↓" : ""}</i></button></th><th className={rankingTableSort === "runsAverage" ? "active" : ""}><button onClick={() => chooseRankingTableSort("runsAverage")}>RA <i>{rankingTableSort === "runsAverage" ? rankingSortDirection === "asc" ? "↑" : "↓" : ""}</i></button></th><th className={rankingTableSort === "strikeRate" ? "active" : ""}><button onClick={() => chooseRankingTableSort("strikeRate")}>SR <i>{rankingTableSort === "strikeRate" ? rankingSortDirection === "asc" ? "↑" : "↓" : ""}</i></button></th><th className={rankingTableSort === "wickets" ? "active" : ""}><button onClick={() => chooseRankingTableSort("wickets")}>W <i>{rankingTableSort === "wickets" ? rankingSortDirection === "asc" ? "↑" : "↓" : ""}</i></button></th><th className={rankingTableSort === "impact" ? "active" : ""}><button onClick={() => chooseRankingTableSort("impact")}>C <i>{rankingTableSort === "impact" ? rankingSortDirection === "asc" ? "↑" : "↓" : ""}</i></button></th></tr></thead><tbody>{rankingTablePlayers.map((player, index) => { const target = player.linkedOwnerId ?? player.playerProfileId; return <tr key={player.id}><td><span className={index < 3 ? `medal medal-${index + 1}` : "medal"}>{index + 1}</span></td><td className={rankingTableSort === "name" ? "active" : ""}><button onClick={() => target && openPublicPlayer(target)} disabled={!target}><Initials name={player.name} /><span><b>{player.name}</b><small>{player.games ? rankingTableDisplay(player, rankingTableSort) : "Awaiting first scorecard"}</small></span></button></td><td className={rankingTableSort === "games" ? "active" : ""}>{player.games}</td><td className={rankingTableSort === "runs" ? "active" : ""}>{player.runs}</td><td className={rankingTableSort === "runsAverage" ? "active" : ""}>{player.runsAverage}</td><td className={rankingTableSort === "strikeRate" ? "active" : ""}>{player.strikeRate}</td><td className={rankingTableSort === "wickets" ? "active" : ""}>{player.wickets}</td><td className={rankingTableSort === "impact" ? "active" : ""}>{player.contribution > 0 ? "+" : ""}{player.contribution}</td></tr>; })}</tbody></table>{!rankingTablePlayers.length && <div className="ranking-table-empty"><span>⌕</span><strong>No players match these filters</strong><button onClick={resetRankingTable}>Show every player</button></div>}</div>
              <footer><span><b>G</b> Games</span><span><b>R</b> Runs</span><span><b>RA</b> Runs average</span><span><b>SR</b> Strike rate</span><span><b>W</b> Wickets</span><span><b>C</b> Contribution</span></footer>
            </section>

            <section className="ranking-insights-bridge"><div><p className="overline">BEYOND THE LEADERBOARD</p><h2>How the team wins</h2><span>Rankings show who led. Team Stats explains dot-ball avoidance, resilience, run rotation, scoring consistency and wicket pressure.</span></div><button onClick={() => navigateTo("performance")}>Open Team Stats →</button></section>
          </> : loading ? <section className="ranking-empty"><span>♜</span><h2>Loading rankings…</h2></section> : <section className="ranking-empty"><span>↗</span><h2>The board is ready for your roster</h2><p>Add the season roster in Team Admin. Player statistics will remain at zero until completed scorecards are imported.</p><button onClick={() => navigateTo("team")}>Open Team Admin</button></section>}
        </>}

        {view === "consistency" && <>
          <div className="page-intro"><div><p className="overline">CONSISTENCY BOARD</p><h1>Who performs the same, week after week.</h1><p>Ranked by a reliability score built from the spread of each player&apos;s runs and wickets across every recorded game. Players need at least 5 career games to qualify.</p></div></div>
          <section className="projection-spotlight-grid">
            <article className="projection-spotlight-card runs-race">
              <header><span>MOST RELIABLE BATTER</span></header>
              {mostConsistentBatter ? <>
                <div className="projection-spotlight-player"><Initials name={mostConsistentBatter.name} src={mostConsistentBatter.imageUrl} large /><div><strong>{mostConsistentBatter.name}</strong><small>{mostConsistentBatter.games} games · avg {Math.round(mostConsistentBatter.runsMean * 10) / 10} runs</small></div></div>
                <div className="projection-progress"><i><em style={{ width: `${mostConsistentBatter.battingConsistency}%` }} /></i><span>{mostConsistentBatter.battingConsistency}% batting consistency</span></div>
                <p>Runs swing by an average of {Math.round(mostConsistentBatter.runsSD * 10) / 10} from their {Math.round(mostConsistentBatter.runsMean * 10) / 10} run average — the tightest spread in the squad.</p>
              </> : <div className="panel-empty">Need more qualifying players (5+ games) to rank batting reliability.</div>}
            </article>
            <article className="projection-spotlight-card wickets-race">
              <header><span>MOST RELIABLE BOWLER</span></header>
              {mostConsistentBowler ? <>
                <div className="projection-spotlight-player"><Initials name={mostConsistentBowler.name} src={mostConsistentBowler.imageUrl} large /><div><strong>{mostConsistentBowler.name}</strong><small>{mostConsistentBowler.games} games · avg {Math.round(mostConsistentBowler.wicketsMean * 100) / 100} wkts</small></div></div>
                <div className="projection-progress"><i><em style={{ width: `${mostConsistentBowler.bowlingConsistency}%` }} /></i><span>{mostConsistentBowler.bowlingConsistency}% bowling consistency</span></div>
                <p>Wickets swing by an average of {Math.round(mostConsistentBowler.wicketsSD * 100) / 100} from their {Math.round(mostConsistentBowler.wicketsMean * 100) / 100} wicket average — the tightest spread in the squad.</p>
              </> : <div className="panel-empty">Need more qualifying bowlers (5+ games, 1+ career wicket) to rank bowling reliability.</div>}
            </article>
          </section>
          <section className="ranking-table-card">
            <header><div><p className="overline">FULL BOARD</p><h2>Every qualifying player, ranked</h2><span>{sortedConsistencyPlayers.length} player{sortedConsistencyPlayers.length === 1 ? "" : "s"} with 5+ career games</span></div><div className="ranking-metric-select"><label><span>Sort by</span><select aria-label="Sort consistency board" value={consistencySort} onChange={(event) => setConsistencySort(event.target.value as typeof consistencySort)}><option value="overall">Overall consistency</option><option value="batting">Batting consistency</option><option value="bowling">Bowling consistency</option><option value="games">Games played</option></select></label></div></header>
            {sortedConsistencyPlayers.length ? <div className="ranking-table-scroll"><table><thead><tr><th>Rank</th><th>Player</th><th>G</th><th>Avg R</th><th>R SD</th><th>Bat %</th><th>Avg W</th><th>W SD</th><th>Bowl %</th><th>Overall</th></tr></thead><tbody>{sortedConsistencyPlayers.map((player, index) => <tr key={player.id}><td><span className={index < 3 ? `medal medal-${index + 1}` : "medal"}>{index + 1}</span></td><td><button onClick={() => openPublicPlayer(player.id)}><Initials name={player.name} src={player.imageUrl} /><span><b>{player.name}</b></span></button></td><td>{player.games}</td><td>{Math.round(player.runsMean * 10) / 10}</td><td>{Math.round(player.runsSD * 10) / 10}</td><td>{player.battingConsistency ?? "—"}</td><td>{Math.round(player.wicketsMean * 100) / 100}</td><td>{Math.round(player.wicketsSD * 100) / 100}</td><td>{player.bowlingConsistency ?? "—"}</td><td className="active">{player.overallConsistency}%</td></tr>)}</tbody></table></div> : <div className="ranking-table-empty"><span>⌕</span><strong>No players qualify yet</strong><span>Players need at least 5 career games to appear on the consistency board.</span></div>}
          </section>
        </>}
      </section>

    </div>

    <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigateTo(item.id)}><span>{item.icon}</span>{item.mobileLabel}</button>)}</nav>
  </main></PlayerImageContext.Provider>;
}
