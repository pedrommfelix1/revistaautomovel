CREATE TABLE `siteGalleryImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`url` text NOT NULL,
	`storageKey` varchar(600),
	`altText` varchar(250),
	`caption` text,
	`position` int NOT NULL,
	CONSTRAINT `siteGalleryImages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `site_gallery_position_idx` ON `siteGalleryImages` (`position`);
