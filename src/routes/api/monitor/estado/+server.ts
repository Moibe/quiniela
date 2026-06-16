// GET /api/monitor/estado — para el display en vivo de /labs: los partidos con
// monitoreo activo y su marcador ACTUAL en la BD (lo escribe el runner externo vía
// POST /api/monitor/score). Admin (locals.isAdmin). Solo LEE; quiniela no captura.
import { error, json } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.isAdmin) error(403, 'Solo administración.');

	const rows = await db
		.select({
			id: partidos.id,
			numero: partidos.numero,
			equipoA: partidos.equipoA,
			equipoB: partidos.equipoB,
			golesA: partidos.golesA,
			golesB: partidos.golesB,
			enCurso: partidos.enCurso,
			fecha: partidos.fecha,
			url: partidos.urlCloudbet
		})
		.from(partidos)
		.where(eq(partidos.monitorear, true))
		.orderBy(asc(partidos.numero));

	return json(rows);
};
