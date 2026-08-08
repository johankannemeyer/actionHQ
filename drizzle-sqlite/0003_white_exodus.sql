CREATE TABLE `performance_claims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_profile_id` integer NOT NULL,
	`match_performance_id` integer NOT NULL,
	`claimed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`player_profile_id`) REFERENCES `player_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`match_performance_id`) REFERENCES `match_performances`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `performance_claims_performance_unique` ON `performance_claims` (`match_performance_id`);--> statement-breakpoint
CREATE TABLE `player_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`display_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`email` text,
	`registered_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_profiles_email_unique` ON `player_profiles` (`email`);--> statement-breakpoint
CREATE TABLE `season_fixtures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_season_id` integer NOT NULL,
	`round` text DEFAULT 'Fixture' NOT NULL,
	`match_date` text NOT NULL,
	`match_time` text DEFAULT '' NOT NULL,
	`court` text DEFAULT '' NOT NULL,
	`opponent` text NOT NULL,
	`result` text DEFAULT 'Upcoming' NOT NULL,
	FOREIGN KEY (`team_season_id`) REFERENCES `team_seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `season_player_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_season_id` integer NOT NULL,
	`player_profile_id` integer NOT NULL,
	`source_name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`games` integer DEFAULT 0 NOT NULL,
	`runs` real DEFAULT 0 NOT NULL,
	`runs_average` real DEFAULT 0 NOT NULL,
	`strike_rate` real DEFAULT 0 NOT NULL,
	`times_out` integer DEFAULT 0 NOT NULL,
	`overs_bowled` real DEFAULT 0 NOT NULL,
	`wickets` integer DEFAULT 0 NOT NULL,
	`wicket_average` real DEFAULT 0 NOT NULL,
	`runs_conceded` real DEFAULT 0 NOT NULL,
	`runs_conceded_average` real DEFAULT 0 NOT NULL,
	`contribution` real DEFAULT 0 NOT NULL,
	`contribution_average` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`team_season_id`) REFERENCES `team_seasons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_profile_id`) REFERENCES `player_profiles`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `season_player_stats_profile_unique` ON `season_player_stats` (`team_season_id`,`player_profile_id`);--> statement-breakpoint
CREATE TABLE `team_seasons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`source_url` text NOT NULL,
	`external_season_id` text NOT NULL,
	`external_league_id` text NOT NULL,
	`external_division_id` text NOT NULL,
	`position` integer,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`draws` integer DEFAULT 0 NOT NULL,
	`average_scored` real DEFAULT 0 NOT NULL,
	`average_conceded` real DEFAULT 0 NOT NULL,
	`last_synced_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_seasons_external_unique` ON `team_seasons` (`team_id`,`external_season_id`,`external_division_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `match_performances_player_unique` ON `match_performances` (`synced_match_id`,`team_name`,`player_name`);