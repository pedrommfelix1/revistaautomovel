ALTER TABLE `analyticsEvents` MODIFY COLUMN `type` enum('pageview','click','timing') NOT NULL;--> statement-breakpoint
ALTER TABLE `analyticsEvents` ADD `durationMs` int;--> statement-breakpoint
ALTER TABLE `analyticsEvents` ADD `visitorId` varchar(40);--> statement-breakpoint
ALTER TABLE `analyticsEvents` ADD `sessionId` varchar(40);--> statement-breakpoint
CREATE INDEX `analyticsEvents_sessionId_idx` ON `analyticsEvents` (`sessionId`);