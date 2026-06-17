// GET /api/monitor/runner — ¿está vivo el runner local? Devuelve { up, haceMs } según el último
// latido (cualquier toque autenticado del runner a targets/score/probe-feed). El front lo pollea
// para mostrar "monitor activo/inactivo". Admin (locals.isAdmin).
import { error, json } from '@sveltejs/kit';
import { latidoRunner } from '$lib/server/monitorHeartbeat';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.isAdmin) error(403, 'Solo administración.');
	return json(latidoRunner(Date.now()));
};
