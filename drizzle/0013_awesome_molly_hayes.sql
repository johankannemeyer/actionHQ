CREATE TABLE `captain_team_invitations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`invited_email` text NOT NULL,
	`invited_by_captain_id` integer NOT NULL,
	`role` text DEFAULT 'co-captain' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`accepted_at` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_captain_id`) REFERENCES `captain_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `captain_team_invitations_team_email_unique` ON `captain_team_invitations` (`team_id`,`invited_email`);