CREATE TABLE `dp_kvs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dp_sentence_translates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sentence` text NOT NULL,
	`translate` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dp_stems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stem` text NOT NULL,
	`familiar` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dp_watch_projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_name` text NOT NULL,
	`type` integer DEFAULT 0 NOT NULL,
	`project_key` text NOT NULL,
	`project_path` text(1024) NOT NULL,
	`current_video_id` integer DEFAULT 0 NOT NULL,
	`last_watch_time` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dp_watch_project_videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`video_name` text NOT NULL,
	`video_path` text(1024) NOT NULL,
	`current_playing` integer DEFAULT false NOT NULL,
	`subtitle_path` text(1024),
	`current_time` integer DEFAULT 0 NOT NULL,
	`duration` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dp_words` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`word` text NOT NULL,
	`stem` text,
	`translate` text,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dp_word_translates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`word` text NOT NULL,
	`translate` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dp_kvs_key_unique` ON `dp_kvs` (`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `dp_sentence_translates_sentence_unique` ON `dp_sentence_translates` (`sentence`);--> statement-breakpoint
CREATE UNIQUE INDEX `dp_stems_stem_unique` ON `dp_stems` (`stem`);--> statement-breakpoint
CREATE UNIQUE INDEX `dp_watch_projects_project_key_unique` ON `dp_watch_projects` (`project_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `dp_watch_project_videos_project_id_video_path_unique` ON `dp_watch_project_videos` (`project_id`,`video_path`);--> statement-breakpoint
CREATE UNIQUE INDEX `dp_words_word_unique` ON `dp_words` (`word`);--> statement-breakpoint
CREATE UNIQUE INDEX `dp_word_translates_word_unique` ON `dp_word_translates` (`word`);