// GET /api/monitor/targets — qué partidos debe vigilar el monitor externo (Plan A).
// Lo consume el runner local (en región permitida) para saber qué URLs de Cloudbet
// abrir. Autenticado con MONITOR_SECRET (header x-monitor-secret).
import { error, json } from '@sveltejs/kit';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const secret = env.MONITOR_SECRET;
	if (!secret || request.headers.get('x-monitor-secret') !== secret) {
		error(401, 'No autorizado.');
	}

	const rows = await db
		.select({
			partidoId: partidos.id,
			numero: partidos.numero,
			equipoA: partidos.equipoA,
			equipoB: partidos.equipoB,
			url: partidos.urlCloudbet
		})
		.from(partidos)
		.where(and(eq(partidos.monitorear, true), isNotNull(partidos.urlCloudbet)));

	return json(rows);
};
