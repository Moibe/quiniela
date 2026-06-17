// GET/POST /api/monitor/probe/feed — canal del lector local del Probador (scripts/probar.mjs).
// GET: la URL que pusiste a probar en /labs. POST { golesA, golesB, local, visita, reloj,
// periodo, error? }: la última lectura de Cloudbet. Autenticado con MONITOR_SECRET. Escribe
// SOLO el sandbox en memoria — nunca `partidos`.
import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getProbe, setProbeLectura } from '$lib/server/probe';
import { marcarLatido } from '$lib/server/monitorHeartbeat';
import type { RequestHandler } from './$types';

function autorizar(request: Request): void {
	const secret = env.MONITOR_SECRET;
	if (!secret || request.headers.get('x-monitor-secret') !== secret) error(401, 'No autorizado.');
	marcarLatido(Date.now()); // latido: el runner está vivo (toca esto cada ~5s)
}

export const GET: RequestHandler = async ({ request }) => {
	autorizar(request);
	return json({ url: getProbe().url });
};

export const POST: RequestHandler = async ({ request }) => {
	autorizar(request);

	const body = await request.json().catch(() => ({}));
	const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
	const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
	const err = str(body.error);

	const marcador = err
		? null
		: {
				golesA: num(body.golesA),
				golesB: num(body.golesB),
				local: str(body.local),
				visita: str(body.visita),
				reloj: str(body.reloj),
				periodo: str(body.periodo)
			};

	setProbeLectura(marcador, err, Date.now());
	return json({ ok: true });
};
