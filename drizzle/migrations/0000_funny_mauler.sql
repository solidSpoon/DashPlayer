CREATE TABLE `dp_clip_tag_relation` (
	`clip_key` text NOT NULL,
	`tag_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`clip_key`, `tag_id`)
);
--> statement-breakpoint
CREATE TABLE `dp_task` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text DEFAULT 'init' NOT NULL,
	`description` text DEFAULT '任务创建成功',
	`result` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dp_kvs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dp_kvs_key_unique` ON `dp_kvs` (`key`);--> statement-breakpoint
CREATE TABLE `dp_sentence_translates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sentence` text NOT NULL,
	`translate` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dp_sentence_translates_sentence_unique` ON `dp_sentence_translates` (`sentence`);--> statement-breakpoint
CREATE TABLE `dp_stems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stem` text NOT NULL,
	`familiar` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dp_stems_stem_unique` ON `dp_stems` (`stem`);--> statement-breakpoint
CREATE TABLE `dp_subtitle_timestamp_adjustment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`subtitle_name` text,
	`subtitle_hash` text,
	`start_at` integer,
	`end_at` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dp_subtitle_timestamp_adjustment_key_unique` ON `dp_subtitle_timestamp_adjustment` (`key`);--> statement-breakpoint
CREATE TABLE `dp_tag` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dp_tag_name_unique` ON `dp_tag` (`name`);--> statement-breakpoint
CREATE TABLE `dp_video_clip` (
	`key` text PRIMARY KEY NOT NULL,
	`video_name` text,
	`srt_clip` text,
	`srt_context` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dp_watch_history` (
	`id` text PRIMARY KEY NOT NULL,
	`project_name` text NOT NULL,
	`project_path` text NOT NULL,
	`project_type` integer NOT NULL,
	`current_position` integer DEFAULT 0 NOT NULL,
	`srt_file` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `base_path_file_name_idx` ON `dp_watch_history` (`project_name`,`project_path`);--> statement-breakpoint
CREATE TABLE `dp_word_translates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`word` text NOT NULL,
	`translate` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dp_word_translates_word_unique` ON `dp_word_translates` (`word`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `dp_words_word_unique` ON `dp_words` (`word`);