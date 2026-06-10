import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { participantes, partidos, pronosticos } from '$lib/server/db/schema';
import { computeStandings } from '$lib/scoring';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [parts, mats, pros] = await Promise.all([
		db.select().from(participantes).orderBy(asc(participantes.posicion), asc(participantes.id)),
		db.select().from(partidos),
		db.select().from(pronosticos)
	]);

	const { standings, partidosJugados } = computeStandings(parts, mats, pros);

	return { standings, partidosJugados, totalPartidos: mats.length };
};
