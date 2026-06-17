// GET /api/monitor/targets — qué partidos debe vigilar el monitor externo (Plan A).
// Lo consume el runner local (en región permitida) para saber qué URLs de Cloudbet
// abrir. Autenticado con MONITOR_SECRET (header x-monitor-secret).
import { error, json } from '@sveltejs/kit';
import { and, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import { env } from '$env/dynamic/private';
import { marcarLatido } from '$lib/server/monitorHeartbeat';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const secret = env.MONITOR_SECRET;
	if (!secret || request.headers.get('x-monitor-secret') !== secret) {
		error(401, 'No autorizado.');
	}
	marcarLatido(Date.now()); // latido: el runner está vivo

	const rows = await db
		.select({
			partidoId: partidos.id,
			numero: partidos.numero,
			equipoA: partidos.equipoA,
			equipoB: partidos.equipoB,
			url: partidos.urlCloudbet
		})
		.from(partidos)
		.where(
			and(
				eq(partidos.monitorear, true),
				isNotNull(partidos.urlCloudbet),
				// No vigilar partidos ya finalizados (marcador final + no en curso): no hay nada que
				// leer y el endpoint de score los protege igual. Evita reintentos inútiles del runner.
				or(isNull(partidos.golesA), eq(partidos.enCurso, true))
			)
		);

	return json(rows);
};
