DROP INDEX IF EXISTS `dp_sentence_translates_sentence_unique`;--> statement-breakpoint
ALTER TABLE `dp_sentence_translates` ADD `mode` text DEFAULT 'tencent' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `dp_sentence_translates_sentence_mode_unique` ON `dp_sentence_translates` (`sentence`,`mode`);