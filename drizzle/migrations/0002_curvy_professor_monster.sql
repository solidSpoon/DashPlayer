DROP INDEX IF EXISTS `dp_watch_projects_project_key_unique`;--> statement-breakpoint
ALTER TABLE dp_watch_projects ADD `current_playing` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `dp_watch_projects_project_path_unique` ON `dp_watch_projects` (`project_path`);--> statement-breakpoint
ALTER TABLE `dp_watch_projects` DROP COLUMN `project_key`;--> statement-breakpoint
ALTER TABLE `dp_watch_projects` DROP COLUMN `current_video_id`;