// Fuente de datos de la página pública "En Vivo".
// Encadena dos fuentes para que la sección NUNCA quede vacía cuando algo se está jugando:
//   1) PRIMARIA — el monitor: los marcadores que el runner empuja al sandbox (Cloudbet in-play),
//      tomando solo los que siguen EN CURSO y FRESCOS (refrescados hace poco).
//   2) FALLBACK — manual: si el monitor no aporta nada en vivo, los partidos que el admin marcó
//      "en curso" a mano en /partidos (marcador provisional de producción).
import { asc, eq, inArray } from 'drizzle-orm';
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
}

export interface EnVivo {
	enCurso: PartidoEnVivo[];
	fuente: FuenteEnVivo;
}

// Sin refrescarse más de esto ⇒ ya no está en vivo (terminó y Cloudbet lo sacó del in-play, o el
// runner se detuvo). El runner muestrea cada ~20s, así que 45s tolera una lectura perdida y a la
// vez reacciona rápido cuando deja de haber datos del monitor.
const FRESCO_MS = 45_000;

export async function partidosEnVivo(ahora: number): Promise<EnVivo> {
	// 1) Primaria: el monitor. Entradas del sandbox aún en curso y frescas.
	const scores = getAllMonitorScores();
	const vivos = new Map([...scores].filter(([, s]) => s.enCurso && ahora - s.ts < FRESCO_MS));

	if (vivos.size) {
		const rows = await db
			.select({
				id: partidos.id,
				numero: partidos.numero,
				equipoA: partidos.equipoA,
				equipoB: partidos.equipoB
			})
			.from(partidos)
			.where(inArray(partidos.id, [...vivos.keys()]))
			.orderBy(asc(partidos.numero));

		return {
			fuente: 'monitor',
			enCurso: rows.map((r) => {
				const s = vivos.get(r.id);
				return {
					numero: r.numero,
					equipoA: r.equipoA,
					equipoB: r.equipoB,
					golesA: s?.golesA ?? null,
					golesB: s?.golesB ?? null
				};
			})
		};
	}

	// 2) Fallback: partidos marcados EN CURSO a mano (marcador provisional de producción).
	const manual = await db
		.select({
			numero: partidos.numero,
			equipoA: partidos.equipoA,
			equipoB: partidos.equipoB,
			golesA: partidos.golesA,
			golesB: partidos.golesB
		})
		.from(partidos)
		.where(eq(partidos.enCurso, true))
		.orderBy(asc(partidos.numero));

	return { fuente: 'manual', enCurso: manual };
}
