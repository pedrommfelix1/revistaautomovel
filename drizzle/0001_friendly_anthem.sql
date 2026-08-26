CREATE TABLE `articleCategories` (
	`articleId` int NOT NULL,
	`categoryId` int NOT NULL,
	CONSTRAINT `articleCategories_articleId_categoryId_pk` PRIMARY KEY(`articleId`,`categoryId`),
	CONSTRAINT `article_category_unique` UNIQUE(`articleId`,`categoryId`)
);
--> statement-breakpoint
CREATE TABLE `articleImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int NOT NULL,
	`url` text NOT NULL,
	`storageKey` varchar(600),
	`altText` varchar(250),
	`caption` text,
	`position` int NOT NULL,
	CONSTRAINT `articleImages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `articleSections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int NOT NULL,
	`type` enum('paragraph','chapter','quote') NOT NULL,
	`heading` varchar(220),
	`body` text,
	`caption` text,
	`position` int NOT NULL,
	CONSTRAINT `articleSections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(220) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`deck` text,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`authorId` int,
	`authorName` varchar(120) NOT NULL,
	`coverImageUrl` text,
	`coverImageCaption` text,
	`isFeatured` boolean NOT NULL DEFAULT false,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `articles_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `articleCategories` ADD CONSTRAINT `articleCategories_articleId_articles_id_fk` FOREIGN KEY (`articleId`) REFERENCES `articles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `articleCategories` ADD CONSTRAINT `articleCategories_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `articleImages` ADD CONSTRAINT `articleImages_articleId_articles_id_fk` FOREIGN KEY (`articleId`) REFERENCES `articles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `articleSections` ADD CONSTRAINT `articleSections_articleId_articles_id_fk` FOREIGN KEY (`articleId`) REFERENCES `articles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_authorId_users_id_fk` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `article_images_position_idx` ON `articleImages` (`articleId`,`position`);--> statement-breakpoint
CREATE INDEX `article_sections_position_idx` ON `articleSections` (`articleId`,`position`);--> statement-breakpoint
CREATE INDEX `articles_status_published_idx` ON `articles` (`status`,`publishedAt`);--> statement-breakpoint
CREATE INDEX `articles_author_idx` ON `articles` (`authorId`);