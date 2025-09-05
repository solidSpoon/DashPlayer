DROP INDEX IF EXISTS `dp_word_translates_word_unique`;--> statement-breakpoint
ALTER TABLE `dp_word_translates` ADD `provider` text DEFAULT 'youdao' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `word_provider_idx` ON `dp_word_translates` (`word`,`provider`);