CREATE TABLE `match_performances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`synced_match_id` integer NOT NULL,
	`team_name` text NOT NULL,
	`player_name` text NOT NULL,
	`runs` real DEFAULT 0 NOT NULL,
	`strike_rate` real DEFAULT 0 NOT NULL,
	`overs_bowled` real DEFAULT 0 NOT NULL,
	`runs_conceded` real DEFAULT 0 NOT NULL,
	`wickets` integer DEFAULT 0 NOT NULL,
	`economy` real DEFAULT 0 NOT NULL,
	`contribution` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`synced_match_id`) REFERENCES `synced_matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `synced_matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fixture_id` text NOT NULL,
	`scoresheet_url` text NOT NULL,
	`home_team` text NOT NULL,
	`away_team` text NOT NULL,
	`home_score` integer DEFAULT 0 NOT NULL,
	`away_score` integer DEFAULT 0 NOT NULL,
	`played_at` text NOT NULL,
	`player_of_match` text DEFAULT '' NOT NULL,
	`kudos` integer DEFAULT 0 NOT NULL,
	`synced_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `synced_matches_fixture_unique` ON `synced_matches` (`fixture_id`);