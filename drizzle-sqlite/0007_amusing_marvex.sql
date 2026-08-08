CREATE TABLE `match_deliveries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_over_id` integer NOT NULL,
	`ball_number` integer NOT NULL,
	`batter_name` text NOT NULL,
	`outcome` text NOT NULL,
	`is_extra` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`match_over_id`) REFERENCES `match_overs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_deliveries_ball_unique` ON `match_deliveries` (`match_over_id`,`ball_number`);--> statement-breakpoint
CREATE TABLE `match_innings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`synced_match_id` integer NOT NULL,
	`innings_number` integer NOT NULL,
	`batting_team` text NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`synced_match_id`) REFERENCES `synced_matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_innings_number_unique` ON `match_innings` (`synced_match_id`,`innings_number`);--> statement-breakpoint
CREATE TABLE `match_overs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_pair_id` integer NOT NULL,
	`over_number` integer NOT NULL,
	`bowler_name` text NOT NULL,
	`wickets` integer DEFAULT 0 NOT NULL,
	`runs` integer DEFAULT 0 NOT NULL,
	`batter_one_total` integer DEFAULT 0 NOT NULL,
	`batter_two_total` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`match_pair_id`) REFERENCES `match_pairs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_overs_number_unique` ON `match_overs` (`match_pair_id`,`over_number`);--> statement-breakpoint
CREATE TABLE `match_pairs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_innings_id` integer NOT NULL,
	`pair_number` integer NOT NULL,
	`batter_one` text NOT NULL,
	`batter_two` text NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`match_innings_id`) REFERENCES `match_innings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_pairs_number_unique` ON `match_pairs` (`match_innings_id`,`pair_number`);