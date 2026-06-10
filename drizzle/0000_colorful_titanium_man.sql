CREATE TABLE `participantes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nombre` text NOT NULL,
	`posicion` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `partidos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`numero` integer NOT NULL,
	`equipo_a` text NOT NULL,
	`equipo_b` text NOT NULL,
	`goles_a` integer,
	`goles_b` integer,
	`fecha` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partidos_numero_unique` ON `partidos` (`numero`);--> statement-breakpoint
CREATE TABLE `pronosticos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`partido_id` integer NOT NULL,
	`participante_id` integer NOT NULL,
	`goles_a` integer NOT NULL,
	`goles_b` integer NOT NULL,
	FOREIGN KEY (`partido_id`) REFERENCES `partidos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participante_id`) REFERENCES `participantes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pronostico_unico` ON `pronosticos` (`partido_id`,`participante_id`);