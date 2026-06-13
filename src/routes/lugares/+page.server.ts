import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { participantes, partidos, pronosticos } from '$lib/server/db/schema';
import { computeStandings } from '$lib/scoring';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	// Atar el load a la navegación (ver nota en la home): re-ejecuta al llegar,
	// para que las posiciones y las flechitas refresquen sin recargar.
	void url.pathname;

	const [parts, mats, pros] = await Promise.all([
		db.select().from(participantes).orderBy(asc(participantes.posicion), asc(participantes.id)),
		db.select().from(partidos),
		db.select().from(pronosticos)
	]);

	const { standings, partidosJugados } = computeStandings(parts, mats, pros);

	// Movimiento vs el ranking previo al último marcador: mov > 0 = subió N
	// lugares, mov < 0 = bajó, 0 = igual, null = sin dato aún.
	const rankPrev = new Map(parts.map((p) => [p.id, p.rankAnterior]));
	const conMov = standings.map((s) => {
		const prev = rankPrev.get(s.participanteId);
		return { ...s, mov: prev == null ? null : prev - s.rank };
	});

	return { standings: conMov, partidosJugados, totalPartidos: mats.length };
};
