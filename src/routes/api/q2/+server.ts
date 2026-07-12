// GET /api/q2 — resultados de los juegos de la Quiniela 2 (para el poll de la página /q2): marcador
// MANUAL persistido + overlay del sandbox del monitor cuando el juego está en vivo. Público: info de la quiniela.
import { json } from '@sveltejs/kit';
import { q2Efectivo } from '$lib/server/enVivo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json({ resultados: await q2Efectivo(Date.now()) });
