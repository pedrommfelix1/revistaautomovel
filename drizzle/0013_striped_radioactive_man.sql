CREATE TABLE `analyticsEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('pageview','click') NOT NULL,
	`path` varchar(300) NOT NULL,
	`label` varchar(120),
	`referrer` varchar(300),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analyticsEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `analyticsEvents_createdAt_idx` ON `analyticsEvents` (`createdAt`);