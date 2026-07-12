// Soporte "en vivo" para los juegos de la Quiniela 2 (bracket J1-J5), SIN meterlos a la tabla
// `partidos` (compartirían equipos con la fase de grupos y romperían la derivación de grupos/bracket).
// El monitor los empareja aparte y su marcador vive SOLO en el sandbox en memoria, con ids sintéticos
// (Q2_ID_BASE + índice del juego). Nunca tocan producción ni las vistas de la quiniela principal.
import { q2Juegos } from '$lib/q2Data';
import { clavePartido } from '$lib/server/equipos';

// Base para los ids sintéticos del sandbox (muy por encima de cualquier id real de `partidos`).
export const Q2_ID_BASE = 90001;

// clave canónica del par de equipos → índice del juego Q2. El id de sandbox = Q2_ID_BASE + índice.
// Los juegos con placeholders ("G J1", etc.) también entran, pero Cloudbet nunca los empuja.
export const q2PorClave = new Map<string, number>(
	q2Juegos.map((j, i) => [clavePartido(j.equipoA, j.equipoB), i])
);
