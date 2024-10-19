ALTER TABLE `dp_watch_history` RENAME COLUMN "last_watch_time" TO "current_position";--> statement-breakpoint
DROP TABLE `dp_watch_project_videos`;--> statement-breakpoint
DROP TABLE `dp_watch_projects`;