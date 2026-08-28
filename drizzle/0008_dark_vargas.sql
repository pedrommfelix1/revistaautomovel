CREATE TABLE `loginAttempts` (
	`bucketKey` varchar(128) NOT NULL,
	`failures` int NOT NULL DEFAULT 0,
	`firstFailureAt` timestamp NOT NULL DEFAULT (now()),
	`blockedUntil` timestamp,
	CONSTRAINT `loginAttempts_bucketKey` PRIMARY KEY(`bucketKey`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(60);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `mustChangePassword` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordChangedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `lastLoginIp` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);