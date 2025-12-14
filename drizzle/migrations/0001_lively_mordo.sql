CREATE TABLE `dp_sys_conf` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dp_sys_conf_key_unique` ON `dp_sys_conf` (`key`);--> statement-breakpoint
CREATE TABLE `dp_video_learning_clip` (
	`key` text PRIMARY KEY NOT NULL,
	`video_name` text,
	`srt_clip` text,
	`srt_context` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dp_video_learning_clip_word` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clip_key` text NOT NULL,
	`word` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_dp_video_learning_clip_word_word_clip_key_unique` ON `dp_video_learning_clip_word` (`word`,`clip_key`);--> statement-breakpoint
DROP INDEX IF EXISTS `dp_sentence_translates_sentence_unique`;--> statement-breakpoint
ALTER TABLE `dp_sentence_translates` ADD `mode` text DEFAULT 'tencent' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `dp_sentence_translates_sentence_mode_unique` ON `dp_sentence_translates` (`sentence`,`mode`);--> statement-breakpoint
DROP INDEX IF EXISTS `dp_word_translates_word_unique`;--> statement-breakpoint
ALTER TABLE `dp_word_translates` ADD `provider` text DEFAULT 'youdao' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `word_provider_idx` ON `dp_word_translates` (`word`,`provider`);