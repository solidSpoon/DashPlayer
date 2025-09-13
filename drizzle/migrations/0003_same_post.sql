CREATE TABLE `dp_video_learning_clip_word` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clip_key` text NOT NULL,
	`word` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `dp_video_learning_clip` DROP COLUMN `matched_word`;