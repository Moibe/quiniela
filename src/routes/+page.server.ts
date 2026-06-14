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

export const load: PageServerLoad = async ({ url }) => {
	// Atar el load a la navegación: al acceder a `url`, SvelteKit re-ejecuta este
	// load al LLEGAR a la página (datos en vivo frescos, sin tener que recargar).
	// Sin esto, cachea el resultado y solo se actualiza con un reload completo.
	void url.pathname;

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

	// Gráfica de pastel: desglose local/empate/visitante de los pronósticos para el
	// partido EN CURSO; si no hay, el SIGUIENTE pendiente (primero por número).
	// null si ya se jugaron todos. (mats viene ordenado por número.)
	const objetivo = mats.find((m) => m.enCurso) ?? mats.find((m) => m.golesA === null);
	let grafica = null;
	if (objetivo) {
		let local = 0;
		let empate = 0;
		let visita = 0;
		for (const pr of pros) {
			if (pr.partidoId !== objetivo.id) continue;
			if (pr.golesA > pr.golesB) local++;
			else if (pr.golesA < pr.golesB) visita++;
			else empate++;
		}
		grafica = {
			numero: objetivo.numero,
			equipoA: objetivo.equipoA,
			equipoB: objetivo.equipoB,
			enCurso: objetivo.enCurso,
			local,
			empate,
			visita,
			total: local + empate + visita
		};
	}

	// Orden FIJO por número (#1→#72): las filas NO se mueven. Los partidos en
	// curso se anuncian con un banner arriba de la tabla, no reordenando.
	return { participantes: parts.map((p) => p.nombre), rows, grafica };
};
