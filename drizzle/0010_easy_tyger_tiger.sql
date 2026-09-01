CREATE TABLE `siteSettings` (
	`id` int NOT NULL,
	`homeKicker` varchar(160),
	`homeHeadline` text,
	`homeSubtitle` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `siteSettings_id` PRIMARY KEY(`id`)
);
