CREATE TABLE `challenge_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_profile_id` integer NOT NULL,
	`challenge_key` text NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`player_profile_id`) REFERENCES `player_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_entries_player_unique` ON `challenge_entries` (`player_profile_id`,`challenge_key`);--> statement-breakpoint
CREATE TABLE `match_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`synced_match_id` integer NOT NULL,
	`player_profile_id` integer,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`synced_match_id`) REFERENCES `synced_matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_profile_id`) REFERENCES `player_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `match_kudos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`synced_match_id` integer NOT NULL,
	`player_profile_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`synced_match_id`) REFERENCES `synced_matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_profile_id`) REFERENCES `player_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_kudos_player_unique` ON `match_kudos` (`synced_match_id`,`player_profile_id`);--> statement-breakpoint
CREATE TABLE `player_follows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`follower_profile_id` integer NOT NULL,
	`following_profile_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`follower_profile_id`) REFERENCES `player_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`following_profile_id`) REFERENCES `player_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_follows_pair_unique` ON `player_follows` (`follower_profile_id`,`following_profile_id`);--> statement-breakpoint
CREATE TABLE `team_invitations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`player_name` text NOT NULL,
	`email` text,
	`token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`claimed_profile_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`claimed_profile_id`) REFERENCES `player_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_invitations_token_unique` ON `team_invitations` (`token`);--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `bio` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `role` text DEFAULT 'All-rounder' NOT NULL;--> statement-breakpoint
ALTER TABLE `player_profiles` ADD `preferred_venue` text DEFAULT '' NOT NULL;