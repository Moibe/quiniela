import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { participantes, partidos, pronosticos } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [parts, mats, pros] = await Promise.all([
		db.select().from(participantes).orderBy(asc(participantes.posicion), asc(participantes.id)),
		db.select().from(partidos).orderBy(asc(partidos.numero)),
		db.select().from(pronosticos)
	]);

	// partidoId → (participanteId → "golesA-golesB")
	const byPartido = new Map<number, Map<number, string>>();
	for (const pr of pros) {
		let m = byPartido.get(pr.partidoId);
		if (!m) {
			m = new Map();
			byPartido.set(pr.partidoId, m);
		}
		m.set(pr.participanteId, `${pr.golesA}-${pr.golesB}`);
	}

	// Filas alineadas al orden de participantes (pronos[i] = participante i).
	const rows = mats.map((m) => ({
		numero: m.numero,
		equipoA: m.equipoA,
		equipoB: m.equipoB,
		pronos: parts.map((p) => byPartido.get(m.id)?.get(p.id) ?? '')
	}));

	return { participantes: parts.map((p) => p.nombre), rows };
};
