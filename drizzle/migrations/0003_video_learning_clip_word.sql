-- 为视频学习片段添加单词关联表
CREATE TABLE `dp_video_learning_clip_word` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clip_key` text NOT NULL,
	`word` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 为 clip_key 和 word 字段创建索引以提高查询性能
CREATE INDEX `idx_dp_video_learning_clip_word_clip_key` ON `dp_video_learning_clip_word` (`clip_key`);
CREATE INDEX `idx_dp_video_learning_clip_word_word` ON `dp_video_learning_clip_word` (`word`);

-- 创建唯一索引避免重复关联
CREATE UNIQUE INDEX `idx_dp_video_learning_clip_word_clip_key_word` ON `dp_video_learning_clip_word` (`clip_key`, `word`);