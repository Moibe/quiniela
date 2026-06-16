// Sandbox del "Probador" de Labs: una URL de Cloudbet de prueba + el último marcador que el
// lector local (scripts/probar.mjs) leyó de ella. EFÍMERO y en memoria — NO toca la BD ni
// `partidos`; nada de esto cuenta para la quiniela. Se borra al reiniciar el server.
export interface ProbeMarcador {
	golesA: number | null;
	golesB: number | null;
	local: string | null;
	visita: string | null;
	reloj: string | null;
	periodo: string | null;
}

export interface ProbeEstado {
	url: string | null;
	marcador: ProbeMarcador | null;
	error: string | null;
	ts: number | null; // epoch ms de la última lectura empujada por el lector
}

// Singleton de proceso (sobrevive el HMR del dev server, igual que el paquete).
const g = globalThis as typeof globalThis & { __labsProbe?: ProbeEstado };
const estado: ProbeEstado = (g.__labsProbe ??= { url: null, marcador: null, error: null, ts: null });

/** Fija (o limpia, con null) la URL a probar y resetea la lectura previa. */
export function setProbeUrl(url: string | null): void {
	estado.url = url;
	estado.marcador = null;
	estado.error = null;
	estado.ts = null;
}

/** Guarda la última lectura (o un error) que empujó el lector local. */
export function setProbeLectura(
	marcador: ProbeMarcador | null,
	error: string | null,
	ts: number
): void {
	estado.marcador = marcador;
	estado.error = error;
	estado.ts = ts;
}

export function getProbe(): ProbeEstado {
	return { url: estado.url, marcador: estado.marcador, error: estado.error, ts: estado.ts };
}
