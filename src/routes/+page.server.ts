import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { participantes, partidos, pronosticos } from '$lib/server/db/schema';
import { puntosDe, PUNTOS_EXACTO, PUNTOS_RESULTADO } from '$lib/scoring';
import { partidosEnVivo } from '$lib/server/enVivo';
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

	const ahora = Date.now();
	const [parts, mats, pros, enVivo] = await Promise.all([
		db.select().from(participantes).orderBy(asc(participantes.posicion), asc(participantes.id)),
		db.select().from(partidos).orderBy(asc(partidos.numero)),
		db.select().from(pronosticos),
		// MISMA fuente que la página "En Vivo": el marcador y el estado en vivo (monitor automático que
		// vive en el sandbox, o captura manual en la BD) salen de aquí, NO del flag/score sueltos de la
		// BD. Así Participantes y En Vivo SIEMPRE coinciden, sea cual sea la forma de captura.
		partidosEnVivo(ahora)
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

	// numero → entrada en vivo (marcador efectivo + estado + minuto), tal como la muestra "En Vivo".
	const vivoPorNumero = new Map(enVivo.enCurso.map((e) => [e.numero, e]));

	// Filas alineadas al orden de participantes (pronos[i] = participante i).
	// Cada celda lleva el marcador pronosticado (s) y su acierto (hit) contra
	// el marcador EFECTIVO (en vivo si lo hay; si no, el final de la BD).
	const rows = mats.map((m) => {
		const v = vivoPorNumero.get(m.numero);
		// "En curso" = en juego según En Vivo (vivo o desconectado). 'terminado'/'porEmpezar' no pulsan.
		const enCurso = !!v && (v.estado === 'vivo' || v.estado === 'desconectado');
		// Marcador EFECTIVO: el de En Vivo (monitor/manual) MANDA; si no hay, el final de la BD.
		const live =
			v && v.golesA !== null && v.golesB !== null ? { golesA: v.golesA, golesB: v.golesB } : null;
		const real =
			live ?? (m.golesA !== null && m.golesB !== null ? { golesA: m.golesA, golesB: m.golesB } : null);

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
			jugado: real !== null && !enCurso,
			enCurso,
			minuto: v?.minuto ?? null,
			real: real ? `${real.golesA}-${real.golesB}` : null,
			pronos
		};
	});

	// Partido a auto-enfocar al entrar: el primero EN CURSO; si ninguno, el jugado MÁS RECIENTE
	// (por fecha de captura). null = nada que enfocar (la tabla arranca arriba).
	let focoNumero: number | null = rows.find((r) => r.enCurso)?.numero ?? null;
	if (focoNumero === null) {
		let foco: (typeof mats)[number] | null = null;
		for (const m of mats) {
			if (m.golesA !== null && m.golesB !== null && m.fecha) {
				if (!foco || m.fecha.getTime() > (foco.fecha?.getTime() ?? 0)) foco = m;
			}
		}
		focoNumero = foco?.numero ?? null;
	}

	// Orden FIJO por número (#1→#72): las filas NO se mueven. Los partidos en
	// curso se anuncian con un banner arriba de la tabla, no reordenando.
	return { participantes: parts.map((p) => p.nombre), rows, focoNumero };
};
