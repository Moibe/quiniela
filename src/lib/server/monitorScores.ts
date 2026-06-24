// Sandbox EN MEMORIA de los marcadores que captura el monitor de Labs. Guarda el marcador vivo
// por partido SIN tocar `partidos` (la BD que cuenta para puntos/posiciones). Labs es para
// PROBAR: lo que empuje el runner vive aquí y desaparece al reiniciar el server — nunca afecta
// producción. (El día que se quiera que el monitor maneje los marcadores REALES, habría que
// escribir en `partidos`; es un cambio aparte, a propósito.)
export interface MarcadorMonitor {
	golesA: number | null;
	golesB: number | null;
	enCurso: boolean;
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
	ts: number
): void {
	const prev = scores.get(partidoId);
	// cambioTs solo avanza cuando el MARCADOR cambia (no en cada refresco de ~20s del runner).
	const cambio = !prev || prev.golesA !== golesA || prev.golesB !== golesB;
	scores.set(partidoId, { golesA, golesB, enCurso, ts, cambioTs: cambio ? ts : prev.cambioTs });
}

export function getMonitorScore(partidoId: number): MarcadorMonitor | null {
	return scores.get(partidoId) ?? null;
}

/** Todos los marcadores del sandbox (partidoId → marcador). Lo usan /estado y el load de /labs. */
export function getAllMonitorScores(): Map<number, MarcadorMonitor> {
	return scores;
}
