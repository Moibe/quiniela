// POST /api/monitor/catalogo — el runner empuja el catálogo del listado in-play (todos los partidos
// con marcador: { id, nombreA, nombreB, gA, gB, minuto }). El server EMPAREJA cada uno con la
// quiniela por NOMBRE (canon) o por ID de urlCloudbet (override manual), y escribe el marcador en el
// SANDBOX (no toca producción; Labs es para probar). Alinea local/visita al equipoA de la quiniela
// (arregla el orden de Cloudbet solo). Autenticado con MONITOR_SECRET.
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import { setMonitorScore } from '$lib/server/monitorScores';
import { canonEquipo, clavePartido } from '$lib/server/equipos';
import { marcarLatido } from '$lib/server/monitorHeartbeat';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const idDe = (url: unknown): string | null => {
	const m = String(url ?? '').match(/\/(\d{4,})(?:[/?#]|$)/);
	return m ? m[1] : null;
};

export const POST: RequestHandler = async ({ request }) => {
	const secret = env.MONITOR_SECRET;
	if (!secret || request.headers.get('x-monitor-secret') !== secret) error(401, 'No autorizado.');
	marcarLatido(Date.now());

	const body = await request.json().catch(() => ({}));
	const matches: Array<Record<string, unknown>> = Array.isArray(body.matches) ? body.matches : [];

	const filas = await db
		.select({
			id: partidos.id,
			equipoA: partidos.equipoA,
			equipoB: partidos.equipoB,
			urlCloudbet: partidos.urlCloudbet
		})
		.from(partidos);
	const porId = new Map<string, (typeof filas)[number]>(); // id Cloudbet (override por URL) → partido
	const porClave = new Map<string, (typeof filas)[number]>(); // par canónico de equipos → partido
	for (const p of filas) {
		const cid = idDe(p.urlCloudbet);
		if (cid) porId.set(cid, p);
		porClave.set(clavePartido(p.equipoA, p.equipoB), p);
	}

	const ts = Date.now();
	let emparejados = 0;
	const sinEmparejar: { nombreA: string; nombreB: string }[] = [];
	for (const m of matches) {
		const gA = Number(m.gA);
		const gB = Number(m.gB);
		if (!Number.isInteger(gA) || !Number.isInteger(gB)) continue;
		const nombreA = String(m.nombreA ?? '');
		const nombreB = String(m.nombreB ?? '');
		const porUrl = m.id != null ? porId.get(String(m.id)) : undefined;
		const p = porUrl ?? porClave.get(clavePartido(nombreA, nombreB));
		if (!p) {
			sinEmparejar.push({ nombreA: nombreA || '?', nombreB: nombreB || '?' });
			continue;
		}
		// Alinea local/visita al equipoA de la quiniela.
		const cA = canonEquipo(p.equipoA);
		const aEsLocal = cA === canonEquipo(nombreA) ? true : cA === canonEquipo(nombreB) ? false : true;
		setMonitorScore(p.id, aEsLocal ? gA : gB, aEsLocal ? gB : gA, Boolean(m.minuto), ts);
		emparejados++;
	}

	return json({ ok: true, recibidos: matches.length, emparejados, sinEmparejar });
};
