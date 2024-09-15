CREATE TABLE `dp_clip_tag_relation` (
	`clip_key` text NOT NULL,
	`tag_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`clip_key`, `tag_id`)
);
--> statement-breakpoint
CREATE TABLE `dp_tag` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dp_video_clip` (
	`key` text PRIMARY KEY NOT NULL,
	`video_name` text,
	`srt_clip` text,
	`srt_context` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dp_tag_name_unique` ON `dp_tag` (`name`);