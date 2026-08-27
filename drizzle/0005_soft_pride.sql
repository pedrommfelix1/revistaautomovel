CREATE TABLE `magazineIssues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(220) NOT NULL,
	`pdfUrl` text NOT NULL,
	`pdfStorageKey` varchar(600),
	`coverImageUrl` text,
	`coverImageStorageKey` varchar(600),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `magazineIssues_id` PRIMARY KEY(`id`)
);
