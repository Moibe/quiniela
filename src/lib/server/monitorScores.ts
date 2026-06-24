// Sandbox EN MEMORIA de los marcadores que captura el monitor de Labs. Guarda el marcador vivo
// por partido SIN tocar `partidos` (la BD que cuenta para puntos/posiciones). Labs es para
// PROBAR: lo que empuje el runner vive aquí y desaparece al reiniciar el server — nunca afecta
// producción. (El día que se quiera que el monitor maneje los marcadores REALES, habría que
// escribir en `partidos`; es un cambio aparte, a propósito.)
export interface MarcadorMonitor {
	golesA: number | null;
	golesB: number | null;
	enCurso: boolean;
	minuto: string | null; // minuto que muestra Cloudbet (ej. "67'"), sin segundos; null si no hay
	ts: number; // epoch ms de la última vez que el runner reportó este partido
	cambioTs: number; // epoch ms de la última vez que CAMBIÓ el marcador (para el respaldo de 4 min)
}

// Singleton de proceso (sobrevive el HMR del dev server, igual que el probador).
const g = globalThis as typeof globalThis & { __monitorScores?: Map<number, MarcadorMonitor> };
const scores: Map<number, MarcadorMonitor> = (g.__monitorScores ??= new Map());

export function setMonitorScore(
	partidoId: number,
	golesA: number,
	golesB: number,
	enCurso: boolean,
	minuto: string | null,
	ts: number
): void {
	const prev = scores.get(partidoId);
	// cambioTs solo avanza cuando el MARCADOR cambia (no en cada refresco de ~20s del runner).
	const cambio = !prev || prev.golesA !== golesA || prev.golesB !== golesB;
	scores.set(partidoId, { golesA, golesB, enCurso, minuto, ts, cambioTs: cambio ? ts : prev.cambioTs });
}

export function getMonitorScore(partidoId: number): MarcadorMonitor | null {
	return scores.get(partidoId) ?? null;
}

/** Todos los marcadores del sandbox (partidoId → marcador). Lo usan /estado y el load de /labs. */
export function getAllMonitorScores(): Map<number, MarcadorMonitor> {
	return scores;
}

/** Minutos (ej. "67'") de los partidos EN VIVO y frescos, por partidoId. Para mostrar el minuto en
 *  las vistas de "en vivo" (En Vivo, badge En Curso de Partidos, banner del Concentrado). */
export function getMinutosVivos(ahora: number, frescoMs = 45_000): Map<number, string> {
	const m = new Map<number, string>();
	for (const [id, s] of scores) {
		if (s.minuto && ahora - s.ts < frescoMs) m.set(id, s.minuto);
	}
	return m;
}
