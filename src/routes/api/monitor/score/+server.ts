// POST /api/monitor/score — ingest del marcador en vivo desde el monitor externo.
// Body: { partidoId, golesA, golesB, final? }. Escribe el marcador igual que el
// admin (enCurso=true mientras esté vivo; final=true lo deja como resultado final).
// Autenticado con MONITOR_SECRET (header x-monitor-secret).
import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const secret = env.MONITOR_SECRET;
	if (!secret || request.headers.get('x-monitor-secret') !== secret) {
		error(401, 'No autorizado.');
	}

	const body = await request.json().catch(() => ({}));
	const partidoId = Number(body.partidoId);
	const golesA = Number(body.golesA);
	const golesB = Number(body.golesB);
	const final = body.final === true;

	if (!Number.isInteger(partidoId)) error(400, 'partidoId inválido.');
	if (!Number.isInteger(golesA) || golesA < 0 || !Number.isInteger(golesB) || golesB < 0) {
		error(400, 'Marcador inválido (enteros ≥ 0).');
	}

	const existe = (
		await db
			.select({ id: partidos.id, golesA: partidos.golesA, enCurso: partidos.enCurso })
			.from(partidos)
			.where(eq(partidos.id, partidoId))
	)[0];
	if (!existe) error(404, 'Partido no encontrado.');

	// Salvaguarda: el monitor NO pisa un partido ya finalizado con resultado. enCurso=false
	// + goles guardados = resultado final; un push aquí casi siempre es una URL mal asignada
	// al partido, y ese marcador cuenta para puntos. Para re-monitorearlo, corrige antes su
	// marcador desde el panel normal. (Partidos por jugar o en curso no se ven afectados.)
	if (existe.golesA != null && existe.enCurso === false) {
		error(409, 'Partido ya finalizado con resultado; el monitor no lo sobreescribe.');
	}

	// Mismo efecto que el guardado del admin: enCurso=true → "Partido en Curso".
	await db
		.update(partidos)
		.set({ golesA, golesB, fecha: new Date(), enCurso: !final })
		.where(eq(partidos.id, partidoId));

	return json({ ok: true, partidoId, golesA, golesB, enCurso: !final });
};
