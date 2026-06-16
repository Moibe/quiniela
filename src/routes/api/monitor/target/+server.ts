// POST /api/monitor/target — el ADMIN asigna a un partido su URL de Cloudbet y
// prende/apaga su monitoreo. Es UI de administración: se gatea con locals.isAdmin
// y NO usa el x-monitor-secret (ese es solo para el runner externo). Escribe
// partidos.urlCloudbet + partidos.monitorear; el runner luego lee esos "targets"
// vía GET /api/monitor/targets. quiniela NO lee Cloudbet (sigue playwright-free).
import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.isAdmin) error(403, 'Solo administración.');

	const body = await request.json().catch(() => ({}));
	const partidoId = Number(body.partidoId);
	if (!Number.isInteger(partidoId)) error(400, 'partidoId inválido.');

	// URL opcional: cadena http/https, o null/"" para limpiarla.
	let urlCloudbet: string | null = null;
	if (typeof body.urlCloudbet === 'string' && body.urlCloudbet.trim()) {
		const u = body.urlCloudbet.trim();
		try {
			const parsed = new URL(u);
			if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
		} catch {
			error(400, 'URL inválida (debe ser http/https).');
		}
		urlCloudbet = u;
	}

	const monitorear = body.monitorear === true;

	const existe = (
		await db.select({ id: partidos.id }).from(partidos).where(eq(partidos.id, partidoId))
	)[0];
	if (!existe) error(404, 'Partido no encontrado.');

	await db.update(partidos).set({ urlCloudbet, monitorear }).where(eq(partidos.id, partidoId));

	return json({ ok: true, partidoId, urlCloudbet, monitorear });
};
