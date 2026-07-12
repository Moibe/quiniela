// GET /api/q2 — marcadores EN VIVO de los juegos de la Quiniela 2 (para el poll de la página /q2).
// Solo lee el sandbox (sin BD). Público: es info de la quiniela.
import { json } from '@sveltejs/kit';
import { q2EnVivo } from '$lib/server/enVivo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => json({ resultados: q2EnVivo(Date.now()) });
