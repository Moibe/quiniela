// Fuente de datos de la página pública "En Vivo".
// UNE dos fuentes para mostrar TODOS los partidos que se juegan ahora mismo, venga de donde venga
// el marcador:
//   • monitor — los marcadores que el runner empuja al sandbox (Cloudbet in-play), tomando solo los
//     que siguen EN CURSO y FRESCOS (refrescados hace poco).
//   • manual  — los partidos que el admin marcó "en curso" a mano en /partidos.
// Si un mismo partido cae en ambas, GANA el monitor (es el marcador en vivo real); cada fila indica
// su fuente. Si el monitor está apagado, naturalmente solo quedan los manuales (y viceversa).
import { eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import { getAllMonitorScores } from '$lib/server/monitorScores';

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
}

// Sin refrescarse más de esto ⇒ ya no está en vivo (terminó y Cloudbet lo sacó del in-play, o el
// runner se detuvo). El runner muestrea cada ~20s, así que 45s tolera una lectura perdida y a la
// vez reacciona rápido cuando deja de haber datos del monitor.
const FRESCO_MS = 45_000;

export async function partidosEnVivo(ahora: number): Promise<EnVivo> {
	// Fuente 1 — monitor: entradas del sandbox aún en curso y frescas.
	const scores = getAllMonitorScores();
	const vivos = new Map([...scores].filter(([, s]) => s.enCurso && ahora - s.ts < FRESCO_MS));

	// Fuente 2 — manual: partidos marcados EN CURSO a mano (marcador provisional de producción).
	const manualRows = await db
		.select({
			id: partidos.id,
			numero: partidos.numero,
			equipoA: partidos.equipoA,
			equipoB: partidos.equipoB,
			golesA: partidos.golesA,
			golesB: partidos.golesB
		})
		.from(partidos)
		.where(eq(partidos.enCurso, true));

	// Nombres/numero de los partidos monitoreados (de la BD; el sandbox solo guarda id y goles).
	const monRows = vivos.size
		? await db
				.select({
					id: partidos.id,
					numero: partidos.numero,
					equipoA: partidos.equipoA,
					equipoB: partidos.equipoB
				})
				.from(partidos)
				.where(inArray(partidos.id, [...vivos.keys()]))
		: [];

	// Unión por id: el monitor gana sobre lo manual cuando un partido está en ambas.
	const porId = new Map<number, PartidoEnVivo>();

	for (const r of monRows) {
		const s = vivos.get(r.id);
		porId.set(r.id, {
			numero: r.numero,
			equipoA: r.equipoA,
			equipoB: r.equipoB,
			golesA: s?.golesA ?? null,
			golesB: s?.golesB ?? null,
			fuente: 'monitor'
		});
	}
	for (const r of manualRows) {
		if (porId.has(r.id)) continue; // ya cubierto por el monitor
		porId.set(r.id, {
			numero: r.numero,
			equipoA: r.equipoA,
			equipoB: r.equipoB,
			golesA: r.golesA,
			golesB: r.golesB,
			fuente: 'manual'
		});
	}

	// Orden fijo por número de partido (#1→#72), igual que el resto de la app.
	const enCurso = [...porId.values()].sort((a, b) => a.numero - b.numero);
	return { enCurso };
}
