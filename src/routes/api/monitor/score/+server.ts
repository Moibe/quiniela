// POST /api/monitor/score — ingest del marcador en vivo desde el monitor externo. Body:
// { partidoId, golesA, golesB, final? }. Escribe en el SANDBOX en memoria (ver
// $lib/server/monitorScores), NO en `partidos`: Labs es para probar y NO debe tocar los datos de
// producción (que cuentan para puntos). Autenticado con MONITOR_SECRET (header x-monitor-secret).
import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import { setMonitorScore } from '$lib/server/monitorScores';
import { marcarLatido } from '$lib/server/monitorHeartbeat';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const secret = env.MONITOR_SECRET;
	if (!secret || request.headers.get('x-monitor-secret') !== secret) {
		error(401, 'No autorizado.');
	}
	marcarLatido(Date.now()); // latido: el runner está vivo

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
		await db.select({ id: partidos.id }).from(partidos).where(eq(partidos.id, partidoId))
	)[0];
	if (!existe) error(404, 'Partido no encontrado.');

	// Sandbox en memoria — NO toca `partidos`. enCurso=true mientras está vivo; final=true lo
	// marca terminado en el sandbox (sigue sin afectar producción ni los puntos).
	setMonitorScore(partidoId, golesA, golesB, !final, Date.now());

	return json({ ok: true, partidoId, golesA, golesB, enCurso: !final });
};
