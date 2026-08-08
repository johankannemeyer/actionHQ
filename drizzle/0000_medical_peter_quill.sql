CREATE TABLE "captain_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"phone" text,
	"privacy_consent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "captain_team_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"invited_email" text NOT NULL,
	"invited_by_captain_id" integer NOT NULL,
	"role" text DEFAULT 'co-captain' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "captain_team_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"captain_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_profile_id" integer NOT NULL,
	"challenge_key" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixtures" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_season_id" integer,
	"scoresheet_url" text NOT NULL,
	"team_name" text DEFAULT 'Your team' NOT NULL,
	"opponent" text DEFAULT 'Opponent to confirm' NOT NULL,
	"fixture_date" text,
	"venue" text DEFAULT 'Action Sports South Africa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"synced_match_id" integer NOT NULL,
	"player_profile_id" integer,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_over_id" integer NOT NULL,
	"ball_number" integer NOT NULL,
	"batter_name" text NOT NULL,
	"outcome" text NOT NULL,
	"is_extra" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_innings" (
	"id" serial PRIMARY KEY NOT NULL,
	"synced_match_id" integer NOT NULL,
	"innings_number" integer NOT NULL,
	"batting_team" text NOT NULL,
	"total" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_kudos" (
	"id" serial PRIMARY KEY NOT NULL,
	"synced_match_id" integer NOT NULL,
	"player_profile_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_overs" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_pair_id" integer NOT NULL,
	"over_number" integer NOT NULL,
	"bowler_name" text NOT NULL,
	"wickets" integer DEFAULT 0 NOT NULL,
	"runs" integer DEFAULT 0 NOT NULL,
	"batter_one_total" integer DEFAULT 0 NOT NULL,
	"batter_two_total" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_pairs" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_innings_id" integer NOT NULL,
	"pair_number" integer NOT NULL,
	"batter_one" text NOT NULL,
	"batter_two" text NOT NULL,
	"total" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_performances" (
	"id" serial PRIMARY KEY NOT NULL,
	"synced_match_id" integer NOT NULL,
	"team_name" text NOT NULL,
	"player_name" text NOT NULL,
	"runs" real DEFAULT 0 NOT NULL,
	"strike_rate" real DEFAULT 0 NOT NULL,
	"overs_bowled" real DEFAULT 0 NOT NULL,
	"runs_conceded" real DEFAULT 0 NOT NULL,
	"wickets" integer DEFAULT 0 NOT NULL,
	"economy" real DEFAULT 0 NOT NULL,
	"contribution" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"round" text DEFAULT 'Fixture' NOT NULL,
	"match_date" text NOT NULL,
	"match_time" text DEFAULT '' NOT NULL,
	"court" text DEFAULT '' NOT NULL,
	"opponent" text NOT NULL,
	"result" text DEFAULT 'Upcoming' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_profile_id" integer NOT NULL,
	"match_performance_id" integer NOT NULL,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_profile_id" integer NOT NULL,
	"following_profile_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_profile_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_profile_id" integer NOT NULL,
	"source_profile_id" integer NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"email" text,
	"phone" text,
	"bio" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'All-rounder' NOT NULL,
	"preferred_venue" text DEFAULT '' NOT NULL,
	"registered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" text NOT NULL,
	"games" integer DEFAULT 0 NOT NULL,
	"runs" real DEFAULT 0 NOT NULL,
	"runs_average" real DEFAULT 0 NOT NULL,
	"strike_rate" real DEFAULT 0 NOT NULL,
	"times_out" integer DEFAULT 0 NOT NULL,
	"overs_bowled" real DEFAULT 0 NOT NULL,
	"wickets" integer DEFAULT 0 NOT NULL,
	"wicket_average" real DEFAULT 0 NOT NULL,
	"runs_conceded" real DEFAULT 0 NOT NULL,
	"runs_conceded_average" real DEFAULT 0 NOT NULL,
	"contribution" real DEFAULT 0 NOT NULL,
	"contribution_average" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "season_fixtures" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_season_id" integer NOT NULL,
	"round" text DEFAULT 'Fixture' NOT NULL,
	"match_date" text NOT NULL,
	"match_time" text DEFAULT '' NOT NULL,
	"court" text DEFAULT '' NOT NULL,
	"opponent" text NOT NULL,
	"result" text DEFAULT 'Upcoming' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "season_player_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_season_id" integer NOT NULL,
	"player_profile_id" integer NOT NULL,
	"source_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"games" integer DEFAULT 0 NOT NULL,
	"runs" real DEFAULT 0 NOT NULL,
	"runs_average" real DEFAULT 0 NOT NULL,
	"strike_rate" real DEFAULT 0 NOT NULL,
	"times_out" integer DEFAULT 0 NOT NULL,
	"overs_bowled" real DEFAULT 0 NOT NULL,
	"wickets" integer DEFAULT 0 NOT NULL,
	"wicket_average" real DEFAULT 0 NOT NULL,
	"runs_conceded" real DEFAULT 0 NOT NULL,
	"runs_conceded_average" real DEFAULT 0 NOT NULL,
	"contribution" real DEFAULT 0 NOT NULL,
	"contribution_average" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "synced_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_season_id" integer,
	"fixture_id" text NOT NULL,
	"scoresheet_url" text NOT NULL,
	"match_type" text DEFAULT 'league' NOT NULL,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"home_score" integer DEFAULT 0 NOT NULL,
	"away_score" integer DEFAULT 0 NOT NULL,
	"home_skin_1" integer DEFAULT 0 NOT NULL,
	"home_skin_2" integer DEFAULT 0 NOT NULL,
	"home_skin_3" integer DEFAULT 0 NOT NULL,
	"home_skin_4" integer DEFAULT 0 NOT NULL,
	"away_skin_1" integer DEFAULT 0 NOT NULL,
	"away_skin_2" integer DEFAULT 0 NOT NULL,
	"away_skin_3" integer DEFAULT 0 NOT NULL,
	"away_skin_4" integer DEFAULT 0 NOT NULL,
	"home_skins" integer DEFAULT 0 NOT NULL,
	"away_skins" integer DEFAULT 0 NOT NULL,
	"home_points" integer DEFAULT 0 NOT NULL,
	"away_points" integer DEFAULT 0 NOT NULL,
	"played_at" text NOT NULL,
	"player_of_match" text DEFAULT '' NOT NULL,
	"kudos" integer DEFAULT 0 NOT NULL,
	"removed_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"player_name" text NOT NULL,
	"email" text,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"claimed_profile_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"source_url" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"league_name" text DEFAULT '' NOT NULL,
	"external_season_id" text NOT NULL,
	"external_league_id" text NOT NULL,
	"external_division_id" text NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"position" integer,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"average_scored" real DEFAULT 0 NOT NULL,
	"average_conceded" real DEFAULT 0 NOT NULL,
	"removed_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_url" text NOT NULL,
	"external_team_id" text NOT NULL,
	"venue_id" text NOT NULL,
	"league_id" text NOT NULL,
	"season_id" text NOT NULL,
	"division_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"average_scored" real DEFAULT 0 NOT NULL,
	"average_conceded" real DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "captain_team_invitations" ADD CONSTRAINT "captain_team_invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captain_team_invitations" ADD CONSTRAINT "captain_team_invitations_invited_by_captain_id_captain_accounts_id_fk" FOREIGN KEY ("invited_by_captain_id") REFERENCES "public"."captain_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captain_team_memberships" ADD CONSTRAINT "captain_team_memberships_captain_id_captain_accounts_id_fk" FOREIGN KEY ("captain_id") REFERENCES "public"."captain_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captain_team_memberships" ADD CONSTRAINT "captain_team_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_entries" ADD CONSTRAINT "challenge_entries_player_profile_id_player_profiles_id_fk" FOREIGN KEY ("player_profile_id") REFERENCES "public"."player_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_team_season_id_team_seasons_id_fk" FOREIGN KEY ("team_season_id") REFERENCES "public"."team_seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_comments" ADD CONSTRAINT "match_comments_synced_match_id_synced_matches_id_fk" FOREIGN KEY ("synced_match_id") REFERENCES "public"."synced_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_comments" ADD CONSTRAINT "match_comments_player_profile_id_player_profiles_id_fk" FOREIGN KEY ("player_profile_id") REFERENCES "public"."player_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_deliveries" ADD CONSTRAINT "match_deliveries_match_over_id_match_overs_id_fk" FOREIGN KEY ("match_over_id") REFERENCES "public"."match_overs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_innings" ADD CONSTRAINT "match_innings_synced_match_id_synced_matches_id_fk" FOREIGN KEY ("synced_match_id") REFERENCES "public"."synced_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_kudos" ADD CONSTRAINT "match_kudos_synced_match_id_synced_matches_id_fk" FOREIGN KEY ("synced_match_id") REFERENCES "public"."synced_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_kudos" ADD CONSTRAINT "match_kudos_player_profile_id_player_profiles_id_fk" FOREIGN KEY ("player_profile_id") REFERENCES "public"."player_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_overs" ADD CONSTRAINT "match_overs_match_pair_id_match_pairs_id_fk" FOREIGN KEY ("match_pair_id") REFERENCES "public"."match_pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_pairs" ADD CONSTRAINT "match_pairs_match_innings_id_match_innings_id_fk" FOREIGN KEY ("match_innings_id") REFERENCES "public"."match_innings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_performances" ADD CONSTRAINT "match_performances_synced_match_id_synced_matches_id_fk" FOREIGN KEY ("synced_match_id") REFERENCES "public"."synced_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_claims" ADD CONSTRAINT "performance_claims_player_profile_id_player_profiles_id_fk" FOREIGN KEY ("player_profile_id") REFERENCES "public"."player_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_claims" ADD CONSTRAINT "performance_claims_match_performance_id_match_performances_id_fk" FOREIGN KEY ("match_performance_id") REFERENCES "public"."match_performances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_follows" ADD CONSTRAINT "player_follows_follower_profile_id_player_profiles_id_fk" FOREIGN KEY ("follower_profile_id") REFERENCES "public"."player_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_follows" ADD CONSTRAINT "player_follows_following_profile_id_player_profiles_id_fk" FOREIGN KEY ("following_profile_id") REFERENCES "public"."player_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_profile_links" ADD CONSTRAINT "player_profile_links_owner_profile_id_player_profiles_id_fk" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."player_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_profile_links" ADD CONSTRAINT "player_profile_links_source_profile_id_player_profiles_id_fk" FOREIGN KEY ("source_profile_id") REFERENCES "public"."player_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_fixtures" ADD CONSTRAINT "season_fixtures_team_season_id_team_seasons_id_fk" FOREIGN KEY ("team_season_id") REFERENCES "public"."team_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_player_stats" ADD CONSTRAINT "season_player_stats_team_season_id_team_seasons_id_fk" FOREIGN KEY ("team_season_id") REFERENCES "public"."team_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_player_stats" ADD CONSTRAINT "season_player_stats_player_profile_id_player_profiles_id_fk" FOREIGN KEY ("player_profile_id") REFERENCES "public"."player_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synced_matches" ADD CONSTRAINT "synced_matches_team_season_id_team_seasons_id_fk" FOREIGN KEY ("team_season_id") REFERENCES "public"."team_seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "team_invitations_claimed_profile_id_player_profiles_id_fk" FOREIGN KEY ("claimed_profile_id") REFERENCES "public"."player_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_seasons" ADD CONSTRAINT "team_seasons_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "captain_accounts_email_unique" ON "captain_accounts" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "captain_team_invitations_team_email_unique" ON "captain_team_invitations" USING btree ("team_id","invited_email");--> statement-breakpoint
CREATE UNIQUE INDEX "captain_team_memberships_pair_unique" ON "captain_team_memberships" USING btree ("captain_id","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_entries_player_unique" ON "challenge_entries" USING btree ("player_profile_id","challenge_key");--> statement-breakpoint
CREATE UNIQUE INDEX "match_deliveries_ball_unique" ON "match_deliveries" USING btree ("match_over_id","ball_number");--> statement-breakpoint
CREATE UNIQUE INDEX "match_innings_number_unique" ON "match_innings" USING btree ("synced_match_id","innings_number");--> statement-breakpoint
CREATE UNIQUE INDEX "match_kudos_player_unique" ON "match_kudos" USING btree ("synced_match_id","player_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "match_overs_number_unique" ON "match_overs" USING btree ("match_pair_id","over_number");--> statement-breakpoint
CREATE UNIQUE INDEX "match_pairs_number_unique" ON "match_pairs" USING btree ("match_innings_id","pair_number");--> statement-breakpoint
CREATE UNIQUE INDEX "match_performances_player_unique" ON "match_performances" USING btree ("synced_match_id","team_name","player_name");--> statement-breakpoint
CREATE UNIQUE INDEX "performance_claims_performance_unique" ON "performance_claims" USING btree ("match_performance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_follows_pair_unique" ON "player_follows" USING btree ("follower_profile_id","following_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_profile_links_source_unique" ON "player_profile_links" USING btree ("source_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_profile_links_pair_unique" ON "player_profile_links" USING btree ("owner_profile_id","source_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "player_profiles_email_unique" ON "player_profiles" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "season_player_stats_profile_unique" ON "season_player_stats" USING btree ("team_season_id","player_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "synced_matches_fixture_unique" ON "synced_matches" USING btree ("fixture_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_invitations_token_unique" ON "team_invitations" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "team_seasons_external_unique" ON "team_seasons" USING btree ("team_id","external_season_id","external_division_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_source_url_unique" ON "teams" USING btree ("source_url");