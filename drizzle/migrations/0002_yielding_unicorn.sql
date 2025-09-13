CREATE TABLE `dp_video_learning_clip` (
	`key` text PRIMARY KEY NOT NULL,
	`video_name` text,
	`matched_word` text,
	`srt_clip` text,
	`srt_context` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dp_video_learning_tag_relation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clip_key` text NOT NULL,
	`tag_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
