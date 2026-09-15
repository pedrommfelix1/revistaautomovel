ALTER TABLE `articles` MODIFY COLUMN `status` enum('draft','scheduled','published') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `articles` ADD `scheduledAt` timestamp;