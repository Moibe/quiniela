// GET /api/monitor/estado — display en vivo de /labs: los partidos con monitoreo activo y su
// marcador del SANDBOX del monitor (en memoria; lo empuja el runner vía POST /api/monitor/score).
// NO lee los marcadores de producción de `partidos` — Labs no toca producción. De `partidos` solo
// salen los nombres/numero/URL. Admin (locals.isAdmin).
import { error, json } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import { getMonitorScore } from '$lib/server/monitorScores';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.isAdmin) error(403, 'Solo administración.');

	const rows = await db
		.select({
			id: partidos.id,
			numero: partidos.numero,
			equipoA: partidos.equipoA,
			equipoB: partidos.equipoB,
			url: partidos.urlCloudbet
		})
		.from(partidos)
		.where(eq(partidos.monitorear, true))
		.orderBy(asc(partidos.numero));

	// El marcador sale del SANDBOX (no de `partidos`): null si el runner aún no empuja.
	return json(
		rows.map((r) => {
			const s = getMonitorScore(r.id);
			return {
				id: r.id,
				numero: r.numero,
				equipoA: r.equipoA,
				equipoB: r.equipoB,
				golesA: s?.golesA ?? null,
				golesB: s?.golesB ?? null,
				enCurso: s?.enCurso ?? false,
				fecha: s ? new Date(s.ts) : null,
				url: r.url
			};
		})
	);
};
