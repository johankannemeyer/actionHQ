CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_url` text NOT NULL,
	`external_team_id` text NOT NULL,
	`venue_id` text NOT NULL,
	`league_id` text NOT NULL,
	`season_id` text NOT NULL,
	`division_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`draws` integer DEFAULT 0 NOT NULL,
	`average_scored` real DEFAULT 0 NOT NULL,
	`average_conceded` real DEFAULT 0 NOT NULL,
	`last_synced_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_source_url_unique` ON `teams` (`source_url`);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`name` text NOT NULL,
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
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`round` text DEFAULT 'Fixture' NOT NULL,
	`match_date` text NOT NULL,
	`match_time` text DEFAULT '' NOT NULL,
	`court` text DEFAULT '' NOT NULL,
	`opponent` text NOT NULL,
	`result` text DEFAULT 'Upcoming' NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
