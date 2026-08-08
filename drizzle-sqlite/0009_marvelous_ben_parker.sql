ALTER TABLE `fixtures` ADD `team_season_id` integer REFERENCES team_seasons(id);--> statement-breakpoint
ALTER TABLE `synced_matches` ADD `team_season_id` integer REFERENCES team_seasons(id);--> statement-breakpoint
ALTER TABLE `team_seasons` ADD `is_current` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `team_seasons` AS `target`
SET `is_current` = true
WHERE `target`.`id` = (
	SELECT `candidate`.`id`
	FROM `team_seasons` AS `candidate`
	WHERE `candidate`.`team_id` = `target`.`team_id`
	ORDER BY `candidate`.`last_synced_at` DESC, `candidate`.`id` DESC
	LIMIT 1
);--> statement-breakpoint
UPDATE `fixtures`
SET `team_season_id` = (
	SELECT `team_seasons`.`id`
	FROM `team_seasons`
	INNER JOIN `teams` ON `teams`.`id` = `team_seasons`.`team_id`
	WHERE `team_seasons`.`is_current` = true
		AND lower(`teams`.`name`) = lower(`fixtures`.`team_name`)
	LIMIT 1
)
WHERE `team_season_id` IS NULL;--> statement-breakpoint
UPDATE `synced_matches`
SET `team_season_id` = (
	SELECT `team_seasons`.`id`
	FROM `team_seasons`
	INNER JOIN `teams` ON `teams`.`id` = `team_seasons`.`team_id`
	WHERE `team_seasons`.`is_current` = true
		AND (lower(`teams`.`name`) = lower(`synced_matches`.`home_team`) OR lower(`teams`.`name`) = lower(`synced_matches`.`away_team`))
	LIMIT 1
)
WHERE `team_season_id` IS NULL;
