import { boolean, integer, pgTable, real, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const fixtures = pgTable("fixtures", {
  id: serial("id").primaryKey(),
  teamSeasonId: integer("team_season_id").references(() => teamSeasons.id, { onDelete: "set null" }),
  scoresheetUrl: text("scoresheet_url").notNull(),
  teamName: text("team_name").notNull().default("Your team"),
  opponent: text("opponent").notNull().default("Opponent to confirm"),
  fixtureDate: text("fixture_date"),
  venue: text("venue").notNull().default("Action Sports South Africa"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const captainAccounts = pgTable("captain_accounts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  phone: text("phone"),
  privacyConsentAt: timestamp("privacy_consent_at", { withTimezone: true, mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("captain_accounts_email_unique").on(table.email)]);

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  sourceUrl: text("source_url").notNull(),
  externalTeamId: text("external_team_id").notNull(),
  venueId: text("venue_id").notNull(),
  leagueId: text("league_id").notNull(),
  seasonId: text("season_id").notNull(),
  divisionId: text("division_id").notNull(),
  name: text("name").notNull(),
  position: integer("position"),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  averageScored: real("average_scored").notNull().default(0),
  averageConceded: real("average_conceded").notNull().default(0),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("teams_source_url_unique").on(table.sourceUrl)]);

export const captainTeamMemberships = pgTable("captain_team_memberships", {
  id: serial("id").primaryKey(),
  captainId: integer("captain_id").notNull().references(() => captainAccounts.id, { onDelete: "cascade" }),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("captain_team_memberships_pair_unique").on(table.captainId, table.teamId)]);

export const captainTeamInvitations = pgTable("captain_team_invitations", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  invitedEmail: text("invited_email").notNull(),
  invitedByCaptainId: integer("invited_by_captain_id").notNull().references(() => captainAccounts.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("co-captain"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "string" }),
}, (table) => [uniqueIndex("captain_team_invitations_team_email_unique").on(table.teamId, table.invitedEmail)]);

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  games: integer("games").notNull().default(0),
  runs: real("runs").notNull().default(0),
  runsAverage: real("runs_average").notNull().default(0),
  strikeRate: real("strike_rate").notNull().default(0),
  timesOut: integer("times_out").notNull().default(0),
  oversBowled: real("overs_bowled").notNull().default(0),
  wickets: integer("wickets").notNull().default(0),
  wicketAverage: real("wicket_average").notNull().default(0),
  runsConceded: real("runs_conceded").notNull().default(0),
  runsConcededAverage: real("runs_conceded_average").notNull().default(0),
  contribution: real("contribution").notNull().default(0),
  contributionAverage: real("contribution_average").notNull().default(0),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  round: text("round").notNull().default("Fixture"),
  matchDate: text("match_date").notNull(),
  matchTime: text("match_time").notNull().default(""),
  court: text("court").notNull().default(""),
  opponent: text("opponent").notNull(),
  result: text("result").notNull().default("Upcoming"),
});

export const teamSeasons = pgTable("team_seasons", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url").notNull(),
  name: text("name").notNull().default(""),
  leagueName: text("league_name").notNull().default(""),
  externalSeasonId: text("external_season_id").notNull(),
  externalLeagueId: text("external_league_id").notNull(),
  externalDivisionId: text("external_division_id").notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
  position: integer("position"),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  averageScored: real("average_scored").notNull().default(0),
  averageConceded: real("average_conceded").notNull().default(0),
  removedAt: timestamp("removed_at", { withTimezone: true, mode: "string" }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("team_seasons_external_unique").on(table.teamId, table.externalSeasonId, table.externalDivisionId)]);

export const playerProfiles = pgTable("player_profiles", {
  id: serial("id").primaryKey(),
  displayName: text("display_name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  bio: text("bio").notNull().default(""),
  role: text("role").notNull().default("All-rounder"),
  preferredVenue: text("preferred_venue").notNull().default(""),
  registeredAt: timestamp("registered_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("player_profiles_email_unique").on(table.email)]);

export const playerProfileLinks = pgTable("player_profile_links", {
  id: serial("id").primaryKey(),
  ownerProfileId: integer("owner_profile_id").notNull().references(() => playerProfiles.id, { onDelete: "restrict" }),
  sourceProfileId: integer("source_profile_id").notNull().references(() => playerProfiles.id, { onDelete: "restrict" }),
  linkedAt: timestamp("linked_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("player_profile_links_source_unique").on(table.sourceProfileId),
  uniqueIndex("player_profile_links_pair_unique").on(table.ownerProfileId, table.sourceProfileId),
]);

export const seasonPlayerStats = pgTable("season_player_stats", {
  id: serial("id").primaryKey(),
  teamSeasonId: integer("team_season_id").notNull().references(() => teamSeasons.id, { onDelete: "cascade" }),
  playerProfileId: integer("player_profile_id").notNull().references(() => playerProfiles.id, { onDelete: "restrict" }),
  sourceName: text("source_name").notNull(),
  active: boolean("active").notNull().default(true),
  games: integer("games").notNull().default(0),
  runs: real("runs").notNull().default(0),
  runsAverage: real("runs_average").notNull().default(0),
  strikeRate: real("strike_rate").notNull().default(0),
  timesOut: integer("times_out").notNull().default(0),
  oversBowled: real("overs_bowled").notNull().default(0),
  wickets: integer("wickets").notNull().default(0),
  wicketAverage: real("wicket_average").notNull().default(0),
  runsConceded: real("runs_conceded").notNull().default(0),
  runsConcededAverage: real("runs_conceded_average").notNull().default(0),
  contribution: real("contribution").notNull().default(0),
  contributionAverage: real("contribution_average").notNull().default(0),
}, (table) => [uniqueIndex("season_player_stats_profile_unique").on(table.teamSeasonId, table.playerProfileId)]);

export const seasonFixtures = pgTable("season_fixtures", {
  id: serial("id").primaryKey(),
  teamSeasonId: integer("team_season_id").notNull().references(() => teamSeasons.id, { onDelete: "cascade" }),
  round: text("round").notNull().default("Fixture"),
  matchDate: text("match_date").notNull(),
  matchTime: text("match_time").notNull().default(""),
  court: text("court").notNull().default(""),
  opponent: text("opponent").notNull(),
  result: text("result").notNull().default("Upcoming"),
});

export const syncedMatches = pgTable("synced_matches", {
  id: serial("id").primaryKey(),
  teamSeasonId: integer("team_season_id").references(() => teamSeasons.id, { onDelete: "set null" }),
  fixtureId: text("fixture_id").notNull(),
  scoresheetUrl: text("scoresheet_url").notNull(),
  matchType: text("match_type").notNull().default("league"),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  homeScore: integer("home_score").notNull().default(0),
  awayScore: integer("away_score").notNull().default(0),
  homeSkin1: integer("home_skin_1").notNull().default(0),
  homeSkin2: integer("home_skin_2").notNull().default(0),
  homeSkin3: integer("home_skin_3").notNull().default(0),
  homeSkin4: integer("home_skin_4").notNull().default(0),
  awaySkin1: integer("away_skin_1").notNull().default(0),
  awaySkin2: integer("away_skin_2").notNull().default(0),
  awaySkin3: integer("away_skin_3").notNull().default(0),
  awaySkin4: integer("away_skin_4").notNull().default(0),
  homeSkins: integer("home_skins").notNull().default(0),
  awaySkins: integer("away_skins").notNull().default(0),
  homePoints: integer("home_points").notNull().default(0),
  awayPoints: integer("away_points").notNull().default(0),
  playedAt: text("played_at").notNull(),
  playerOfMatch: text("player_of_match").notNull().default(""),
  kudos: integer("kudos").notNull().default(0),
  removedAt: timestamp("removed_at", { withTimezone: true, mode: "string" }),
  syncedAt: timestamp("synced_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("synced_matches_fixture_unique").on(table.fixtureId)]);

export const matchInnings = pgTable("match_innings", {
  id: serial("id").primaryKey(),
  syncedMatchId: integer("synced_match_id").notNull().references(() => syncedMatches.id, { onDelete: "cascade" }),
  inningsNumber: integer("innings_number").notNull(),
  battingTeam: text("batting_team").notNull(),
  total: integer("total").notNull().default(0),
}, (table) => [uniqueIndex("match_innings_number_unique").on(table.syncedMatchId, table.inningsNumber)]);

export const matchPairs = pgTable("match_pairs", {
  id: serial("id").primaryKey(),
  matchInningsId: integer("match_innings_id").notNull().references(() => matchInnings.id, { onDelete: "cascade" }),
  pairNumber: integer("pair_number").notNull(),
  batterOne: text("batter_one").notNull(),
  batterTwo: text("batter_two").notNull(),
  total: integer("total").notNull().default(0),
}, (table) => [uniqueIndex("match_pairs_number_unique").on(table.matchInningsId, table.pairNumber)]);

export const matchOvers = pgTable("match_overs", {
  id: serial("id").primaryKey(),
  matchPairId: integer("match_pair_id").notNull().references(() => matchPairs.id, { onDelete: "cascade" }),
  overNumber: integer("over_number").notNull(),
  bowlerName: text("bowler_name").notNull(),
  wickets: integer("wickets").notNull().default(0),
  runs: integer("runs").notNull().default(0),
  batterOneTotal: integer("batter_one_total").notNull().default(0),
  batterTwoTotal: integer("batter_two_total").notNull().default(0),
}, (table) => [uniqueIndex("match_overs_number_unique").on(table.matchPairId, table.overNumber)]);

export const matchDeliveries = pgTable("match_deliveries", {
  id: serial("id").primaryKey(),
  matchOverId: integer("match_over_id").notNull().references(() => matchOvers.id, { onDelete: "cascade" }),
  ballNumber: integer("ball_number").notNull(),
  batterName: text("batter_name").notNull(),
  outcome: text("outcome").notNull(),
  isExtra: boolean("is_extra").notNull().default(false),
}, (table) => [uniqueIndex("match_deliveries_ball_unique").on(table.matchOverId, table.ballNumber)]);

export const matchPerformances = pgTable("match_performances", {
  id: serial("id").primaryKey(),
  syncedMatchId: integer("synced_match_id").notNull().references(() => syncedMatches.id, { onDelete: "cascade" }),
  teamName: text("team_name").notNull(),
  playerName: text("player_name").notNull(),
  runs: real("runs").notNull().default(0),
  strikeRate: real("strike_rate").notNull().default(0),
  oversBowled: real("overs_bowled").notNull().default(0),
  runsConceded: real("runs_conceded").notNull().default(0),
  wickets: integer("wickets").notNull().default(0),
  economy: real("economy").notNull().default(0),
  contribution: real("contribution").notNull().default(0),
}, (table) => [uniqueIndex("match_performances_player_unique").on(table.syncedMatchId, table.teamName, table.playerName)]);

export const performanceClaims = pgTable("performance_claims", {
  id: serial("id").primaryKey(),
  playerProfileId: integer("player_profile_id").notNull().references(() => playerProfiles.id, { onDelete: "cascade" }),
  matchPerformanceId: integer("match_performance_id").notNull().references(() => matchPerformances.id, { onDelete: "restrict" }),
  claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("performance_claims_performance_unique").on(table.matchPerformanceId)]);

export const teamInvitations = pgTable("team_invitations", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  playerName: text("player_name").notNull(),
  email: text("email"),
  token: text("token").notNull(),
  status: text("status").notNull().default("pending"),
  claimedProfileId: integer("claimed_profile_id").references(() => playerProfiles.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("team_invitations_token_unique").on(table.token)]);

export const matchComments = pgTable("match_comments", {
  id: serial("id").primaryKey(),
  syncedMatchId: integer("synced_match_id").notNull().references(() => syncedMatches.id, { onDelete: "cascade" }),
  playerProfileId: integer("player_profile_id").references(() => playerProfiles.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const matchKudos = pgTable("match_kudos", {
  id: serial("id").primaryKey(),
  syncedMatchId: integer("synced_match_id").notNull().references(() => syncedMatches.id, { onDelete: "cascade" }),
  playerProfileId: integer("player_profile_id").notNull().references(() => playerProfiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("match_kudos_player_unique").on(table.syncedMatchId, table.playerProfileId)]);

export const challengeEntries = pgTable("challenge_entries", {
  id: serial("id").primaryKey(),
  playerProfileId: integer("player_profile_id").notNull().references(() => playerProfiles.id, { onDelete: "cascade" }),
  challengeKey: text("challenge_key").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("challenge_entries_player_unique").on(table.playerProfileId, table.challengeKey)]);

export const playerFollows = pgTable("player_follows", {
  id: serial("id").primaryKey(),
  followerProfileId: integer("follower_profile_id").notNull().references(() => playerProfiles.id, { onDelete: "cascade" }),
  followingProfileId: integer("following_profile_id").notNull().references(() => playerProfiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("player_follows_pair_unique").on(table.followerProfileId, table.followingProfileId)]);
