ALTER TABLE `team_seasons` ADD `name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `team_seasons` ADD `league_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `team_seasons` ADD `removed_at` text;--> statement-breakpoint
UPDATE `team_seasons`
SET `name` = 'Season ' || `external_season_id`,
	`league_name` = 'League ' || `external_league_id`
WHERE `name` = '' OR `league_name` = '';
