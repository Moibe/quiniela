// GET /api/monitor/estado — display en vivo de /labs: los partidos que tienen marcador en el
// SANDBOX (auto-emparejados desde el catálogo del listado por el runner). NO lee el marcador de
// `partidos` — Labs no toca producción. De `partidos` solo salen nombres/numero. Admin.
import { error, json } from '@sveltejs/kit';
import { asc, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import { getAllMonitorScores } from '$lib/server/monitorScores';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.isAdmin) error(403, 'Solo administración.');

	const scores = getAllMonitorScores();
	if (scores.size === 0) return json([]);

	const ids = [...scores.keys()];
	const rows = await db
		.select({
			id: partidos.id,
			numero: partidos.numero,
			equipoA: partidos.equipoA,
			equipoB: partidos.equipoB
		})
		.from(partidos)
		.where(inArray(partidos.id, ids))
		.orderBy(asc(partidos.numero));

	return json(
		rows.map((r) => {
			const s = scores.get(r.id);
			return {
				id: r.id,
				numero: r.numero,
				equipoA: r.equipoA,
				equipoB: r.equipoB,
				golesA: s?.golesA ?? null,
				golesB: s?.golesB ?? null,
				enCurso: s?.enCurso ?? false,
				fecha: s ? new Date(s.ts) : null
			};
		})
	);
};
