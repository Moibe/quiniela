CREATE TABLE `q2_resultados` (
	`etiqueta` text PRIMARY KEY NOT NULL,
	`goles_a` integer,
	`goles_b` integer,
	`en_curso` integer DEFAULT false NOT NULL,
	`fecha` integer
);
