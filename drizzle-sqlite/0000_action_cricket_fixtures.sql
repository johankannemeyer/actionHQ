CREATE TABLE `fixtures` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `scoresheet_url` text NOT NULL,
  `team_name` text DEFAULT 'Your team' NOT NULL,
  `opponent` text DEFAULT 'Opponent to confirm' NOT NULL,
  `fixture_date` text,
  `venue` text DEFAULT 'Action Sports South Africa' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
