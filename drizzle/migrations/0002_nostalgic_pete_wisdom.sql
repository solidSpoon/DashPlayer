CREATE TABLE `dp_watch_history_ext` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`watch_history_id` text NOT NULL,
	`podcast_mode_user_set` integer DEFAULT false NOT NULL,
	`podcast_mode_manual` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dp_watch_history_ext_watch_history_id_unique` ON `dp_watch_history_ext` (`watch_history_id`);