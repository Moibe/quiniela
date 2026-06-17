// Latido del runner local: cada vez que el runner toca un endpoint autenticado (targets / score /
// probe-feed) marcamos "visto ahora". El front consulta si el último latido es reciente para saber
// si el monitor está ARRIBA. En memoria, efímero (se borra al reiniciar el server).
const VIVO_MS = 30_000; // último latido < 30s ⇒ runner vivo (el runner toca el server cada ≤15s)

const g = globalThis as typeof globalThis & { __monitorLatido?: { ultimo: number | null } };
const estado = (g.__monitorLatido ??= { ultimo: null });

export function marcarLatido(ts: number): void {
	estado.ultimo = ts;
}

export function latidoRunner(ahora: number): { up: boolean; haceMs: number | null } {
	const ultimo = estado.ultimo;
	if (ultimo == null) return { up: false, haceMs: null };
	return { up: ahora - ultimo < VIVO_MS, haceMs: ahora - ultimo };
}
