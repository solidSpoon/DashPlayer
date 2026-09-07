PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_dp_word_translates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`word` text NOT NULL,
	`provider` text DEFAULT 'openai' NOT NULL,
	`translate` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_dp_word_translates`("id", "word", "provider", "translate", "created_at", "updated_at") SELECT "id", "word", "provider", "translate", "created_at", "updated_at" FROM `dp_word_translates`;--> statement-breakpoint
DROP TABLE `dp_word_translates`;--> statement-breakpoint
ALTER TABLE `__new_dp_word_translates` RENAME TO `dp_word_translates`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `word_provider_idx` ON `dp_word_translates` (`word`,`provider`);