CREATE TABLE `captain_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`phone` text,
	`privacy_consent_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `captain_accounts_email_unique` ON `captain_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `captain_team_memberships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`captain_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`captain_id`) REFERENCES `captain_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `captain_team_memberships_pair_unique` ON `captain_team_memberships` (`captain_id`,`team_id`);