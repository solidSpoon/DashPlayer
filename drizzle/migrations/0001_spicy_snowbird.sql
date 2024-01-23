CREATE TABLE `dp_subtitle_timestamp_adjustment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`subtitle_name` text,
	`start_at` integer,
	`end_at` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dp_subtitle_timestamp_adjustment_key_unique` ON `dp_subtitle_timestamp_adjustment` (`key`);