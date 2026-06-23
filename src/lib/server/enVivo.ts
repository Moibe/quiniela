// Fuente de datos de la página pública "En Vivo".
// Devuelve dos cosas:
//   • enCurso — los partidos que se juegan ahora mismo, UNIENDO dos fuentes (cada fila trae la suya):
//       - monitor: marcadores que el runner empuja al sandbox (Cloudbet in-play), solo los EN CURSO y
//         FRESCOS (refrescados hace poco).
//       - manual:  partidos que el admin marcó "en curso" a mano en /partidos.
//     Si un partido cae en ambas, gana el monitor (marcador en vivo real).
//   • grupos — las tablas de los grupos involucrados en esos partidos, calculadas con el marcador en
//     vivo APLICADO encima de producción (overlay del monitor), para que la tabla refleje el partido
//     en curso aunque su marcador viva solo en el sandbox.
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import { getAllMonitorScores } from '$lib/server/monitorScores';
import { computeGrupos, type Grupo } from '$lib/grupos';

export type FuenteEnVivo = 'monitor' | 'manual';

export interface PartidoEnVivo {
	numero: number;
	equipoA: string;
	equipoB: string;
	golesA: number | null;
	golesB: number | null;
	fuente: FuenteEnVivo; // de dónde sale el marcador de ESTA fila
}

export interface EnVivo {
	enCurso: PartidoEnVivo[];
	grupos: Grupo[];
}

// Sin refrescarse más de esto ⇒ ya no está en vivo (terminó y Cloudbet lo sacó del in-play, o el
// runner se detuvo). El runner muestrea cada ~20s, así que 45s tolera una lectura perdida y a la
// vez reacciona rápido cuando deja de haber datos del monitor.
const FRESCO_MS = 45_000;

export async function partidosEnVivo(ahora: number): Promise<EnVivo> {
	// Marcadores del monitor aún en curso y frescos.
	const scores = getAllMonitorScores();
	const vivos = new Map([...scores].filter(([, s]) => s.enCurso && ahora - s.ts < FRESCO_MS));

	// Todos los partidos en una sola lectura (sirve para la lista en vivo Y para las tablas).
	const todos = await db
		.select({
			id: partidos.id,
			numero: partidos.numero,
			equipoA: partidos.equipoA,
			equipoB: partidos.equipoB,
			golesA: partidos.golesA,
			golesB: partidos.golesB,
			enCurso: partidos.enCurso
		})
		.from(partidos);

	// --- Lista de partidos en vivo (merge monitor+manual; el monitor gana) ---
	const enCurso: PartidoEnVivo[] = [];
	for (const p of todos) {
		const s = vivos.get(p.id);
		if (s) {
			enCurso.push({
				numero: p.numero,
				equipoA: p.equipoA,
				equipoB: p.equipoB,
				golesA: s.golesA,
				golesB: s.golesB,
				fuente: 'monitor'
			});
		} else if (p.enCurso) {
			enCurso.push({
				numero: p.numero,
				equipoA: p.equipoA,
				equipoB: p.equipoB,
				golesA: p.golesA,
				golesB: p.golesB,
				fuente: 'manual'
			});
		}
	}
	enCurso.sort((a, b) => a.numero - b.numero);

	// --- Tablas de los grupos involucrados, con el marcador del monitor aplicado encima ---
	const equiposVivos = new Set(enCurso.flatMap((m) => [m.equipoA, m.equipoB]));
	let grupos: Grupo[] = [];
	if (equiposVivos.size) {
		const overlaid = todos.map((p) => {
			const s = vivos.get(p.id);
			return s
				? { numero: p.numero, equipoA: p.equipoA, equipoB: p.equipoB, golesA: s.golesA, golesB: s.golesB, enCurso: true }
				: { numero: p.numero, equipoA: p.equipoA, equipoB: p.equipoB, golesA: p.golesA, golesB: p.golesB, enCurso: p.enCurso };
		});
		grupos = computeGrupos(overlaid).filter((g) => g.equipos.some((e) => equiposVivos.has(e.equipo)));
	}

	return { enCurso, grupos };
}
