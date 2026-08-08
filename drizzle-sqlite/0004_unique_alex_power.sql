CREATE TABLE `player_profile_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_profile_id` integer NOT NULL,
	`source_profile_id` integer NOT NULL,
	`linked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_profile_id`) REFERENCES `player_profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_profile_id`) REFERENCES `player_profiles`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_profile_links_source_unique` ON `player_profile_links` (`source_profile_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_profile_links_pair_unique` ON `player_profile_links` (`owner_profile_id`,`source_profile_id`);