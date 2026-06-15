// POST /api/labs/monitor/detener — detiene el monitoreo experimental y libera el
// navegador (Labs, solo admin).
import { error, json } from '@sveltejs/kit';
import { monitorMarcadores } from '@moibe/partido-nucleo';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.isAdmin) error(403, 'Solo admin.');
	await monitorMarcadores.detenerTodo();
	return json({ ok: true });
};
