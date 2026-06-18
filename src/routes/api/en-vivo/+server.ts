// GET /api/en-vivo — partidos marcados EN CURSO con su marcador oficial (de `partidos`), para el
// poll de la página pública "En Vivo". Público (sin gate): es info pública de la quiniela. Solo LEE.
import { json } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const rows = await db
		.select({
			numero: partidos.numero,
			equipoA: partidos.equipoA,
			equipoB: partidos.equipoB,
			golesA: partidos.golesA,
			golesB: partidos.golesB
		})
		.from(partidos)
		.where(eq(partidos.enCurso, true))
		.orderBy(asc(partidos.numero));
	return json(rows);
};
