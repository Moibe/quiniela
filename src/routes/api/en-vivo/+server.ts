// GET /api/en-vivo — marcadores en vivo para el poll de la página pública "En Vivo".
// Misma fuente encadenada monitor→manual que el load (ver $lib/server/enVivo).
// Público (sin gate): es info pública de la quiniela. Solo LEE.
import { json } from '@sveltejs/kit';
import { partidosEnVivo } from '$lib/server/enVivo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json(await partidosEnVivo(Date.now()));
};
