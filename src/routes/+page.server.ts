import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { participantes, partidos, pronosticos } from '$lib/server/db/schema';
import { puntosDe, PUNTOS_EXACTO, PUNTOS_RESULTADO } from '$lib/scoring';
import type { PageServerLoad } from './$types';

// Estado de aciertos de una celda (para iluminar la cuadrícula en guinda):
//  0 = sin pronóstico, o partido sin resultado aún, o falló.
//  1 = acertó el resultado (1 pt) → guinda tenue.
//  2 = marcador exacto (3 pts) → guinda intenso.
type Hit = 0 | 1 | 2;

export const load: PageServerLoad = async () => {
	const [parts, mats, pros] = await Promise.all([
		db.select().from(participantes).orderBy(asc(participantes.posicion), asc(participantes.id)),
		db.select().from(partidos).orderBy(asc(partidos.numero)),
		db.select().from(pronosticos)
	]);

	// partidoId → (participanteId → {golesA, golesB})
	const byPartido = new Map<number, Map<number, { golesA: number; golesB: number }>>();
	for (const pr of pros) {
		let m = byPartido.get(pr.partidoId);
		if (!m) {
			m = new Map();
			byPartido.set(pr.partidoId, m);
		}
		m.set(pr.participanteId, { golesA: pr.golesA, golesB: pr.golesB });
	}

	// Filas alineadas al orden de participantes (pronos[i] = participante i).
	// Cada celda lleva el marcador pronosticado (s) y su acierto (hit) contra
	// el resultado real, si el partido ya se jugó.
	const rows = mats.map((m) => {
		const real =
			m.golesA !== null && m.golesB !== null ? { golesA: m.golesA, golesB: m.golesB } : null;

		const pronos = parts.map((p) => {
			const prono = byPartido.get(m.id)?.get(p.id);
			if (!prono) return { s: '', hit: 0 as Hit };
			const s = `${prono.golesA}-${prono.golesB}`;
			if (!real) return { s, hit: 0 as Hit };
			const pts = puntosDe(prono, real);
			const hit: Hit = pts === PUNTOS_EXACTO ? 2 : pts === PUNTOS_RESULTADO ? 1 : 0;
			return { s, hit };
		});

		return {
			numero: m.numero,
			equipoA: m.equipoA,
			equipoB: m.equipoB,
			jugado: real !== null,
			enCurso: m.enCurso,
			real: real ? `${real.golesA}-${real.golesB}` : null,
			pronos
		};
	});

	// Los partidos EN CURSO flotan al tope de la tabla (para que estén presentes
	// al consultar la general), manteniendo el orden #1→#72 dentro de cada grupo.
	// Sort estable: enCurso primero; si no hay ninguno, queda todo en orden normal.
	rows.sort((a, b) => Number(b.enCurso) - Number(a.enCurso));

	return { participantes: parts.map((p) => p.nombre), rows };
};
