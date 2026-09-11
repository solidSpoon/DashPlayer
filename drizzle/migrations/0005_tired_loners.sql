CREATE TABLE `dp_repair_task` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_path` text NOT NULL,
	`status` text,
	`recipe` text,
	`output_path` text,
	`reason` text,
	`task_id` integer,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dp_repair_task_file_path_unique` ON `dp_repair_task` (`file_path`);