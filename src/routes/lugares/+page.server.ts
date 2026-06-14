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

	// Flechitas = movimiento causado por el ÚLTIMO marcador registrado. En vez de
	// guardar una "foto" (frágil: la borra cerrar un partido o no haber capturado
	// desde que existe la feature), lo CALCULAMOS: comparamos el ranking actual
	// contra el ranking SIN el último partido capturado (el de `fecha` más
	// reciente). Así siempre hay flechas con ≥1 resultado y reflejan el último gol.
	const conFecha = mats.filter((m) => m.golesA !== null && m.golesB !== null && m.fecha);
	const mov = new Map<number, number>();
	if (conFecha.length) {
		const ultima = Math.max(...conFecha.map((m) => (m.fecha as Date).getTime()));
		// El "antes": trata el/los partido(s) recién capturado(s) como no jugados.
		const matsPrevios = mats.map((m) =>
			m.fecha && (m.fecha as Date).getTime() === ultima
				? { ...m, golesA: null, golesB: null }
				: m
		);
		const previo = computeStandings(parts, matsPrevios, pros).standings;
		const rankPrevio = new Map(previo.map((s) => [s.participanteId, s.rank]));
		for (const s of standings) {
			mov.set(s.participanteId, (rankPrevio.get(s.participanteId) ?? s.rank) - s.rank);
		}
	}
	const conMov = standings.map((s) => ({ ...s, mov: mov.get(s.participanteId) ?? 0 }));

	return { standings: conMov, partidosJugados, totalPartidos: mats.length };
};
