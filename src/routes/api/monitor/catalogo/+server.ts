// POST /api/monitor/catalogo — el runner empuja el catálogo del listado in-play. El server:
//  1) EMPAREJA cada partido con la quiniela (por nombre canónico o id de urlCloudbet) y escribe su
//     marcador en el SANDBOX en memoria (lo que ve En Vivo en tiempo real). Alinea local/visita al
//     equipoA de la quiniela (arregla el orden de Cloudbet).
//  2) RESPALDO A PRODUCCIÓN: si el subidor manual NO metió el resultado de un partido, En Vivo lo
//     escribe en `partidos` ~4 min después de que el marcador del monitor quedó estable —provisional
//     mientras sigue en el listado in-play, FINAL cuando ya salió—. Solo escribe en celdas vacías o
//     que el propio monitor escribió antes (autoMonitor); NUNCA pisa un resultado capturado a mano.
// Autenticado con MONITOR_SECRET.
import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import { setMonitorScore, getAllMonitorScores } from '$lib/server/monitorScores';
import { canonEquipo, clavePartido } from '$lib/server/equipos';
import { marcarLatido } from '$lib/server/monitorHeartbeat';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

// El marcador del monitor debe llevar estable este tiempo antes de respaldarlo a producción
// (da margen al subidor manual). Override por env para pruebas; default 4 min.
const PROMOVER_MS = Number(env.MONITOR_PROMOVER_MS) || 4 * 60_000;

const idDe = (url: unknown): string | null => {
	const m = String(url ?? '').match(/\/(\d{4,})(?:[/?#]|$)/);
	return m ? m[1] : null;
};

export const POST: RequestHandler = async ({ request }) => {
	const secret = env.MONITOR_SECRET;
	if (!secret || request.headers.get('x-monitor-secret') !== secret) error(401, 'No autorizado.');
	const ahora = Date.now();
	marcarLatido(ahora);

	const body = await request.json().catch(() => ({}));
	const matches: Array<Record<string, unknown>> = Array.isArray(body.matches) ? body.matches : [];

	const filas = await db
		.select({
			id: partidos.id,
			equipoA: partidos.equipoA,
			equipoB: partidos.equipoB,
			golesA: partidos.golesA,
			golesB: partidos.golesB,
			enCurso: partidos.enCurso,
			autoMonitor: partidos.autoMonitor,
			urlCloudbet: partidos.urlCloudbet
		})
		.from(partidos);
	const porId = new Map<string, (typeof filas)[number]>(); // id Cloudbet (override por URL) → partido
	const porClave = new Map<string, (typeof filas)[number]>(); // par canónico de equipos → partido
	const prodPorId = new Map<number, (typeof filas)[number]>(); // id quiniela → estado en producción
	for (const p of filas) {
		prodPorId.set(p.id, p);
		const cid = idDe(p.urlCloudbet);
		if (cid) porId.set(cid, p);
		porClave.set(clavePartido(p.equipoA, p.equipoB), p);
	}

	// 1) Sandbox: empareja cada partido del push y guarda su marcador.
	const idsEnPush = new Set<number>(); // partidos presentes en ESTE push (siguen in-play)
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
		const cA = canonEquipo(p.equipoA);
		const aEsLocal = cA === canonEquipo(nombreA) ? true : cA === canonEquipo(nombreB) ? false : true;
		setMonitorScore(p.id, aEsLocal ? gA : gB, aEsLocal ? gB : gA, Boolean(m.minuto), m.minuto ? String(m.minuto) : null, ahora);
		idsEnPush.add(p.id);
		emparejados++;
	}

	// 2) Respaldo a producción (ver cabecera).
	let respaldados = 0;
	for (const [id, s] of getAllMonitorScores()) {
		if (!Number.isInteger(s.golesA) || !Number.isInteger(s.golesB)) continue;
		if (ahora - s.cambioTs < PROMOVER_MS) continue; // el marcador aún no lleva el margen estable
		const prod = prodPorId.get(id);
		if (!prod) continue;
		if (prod.golesA !== null && !prod.autoMonitor) continue; // resultado HUMANO: no se toca
		const enCurso = idsEnPush.has(id); // sigue en el listado ⇒ provisional; ya no ⇒ final
		// Evita reescrituras idénticas en cada push.
		if (prod.golesA === s.golesA && prod.golesB === s.golesB && prod.enCurso === enCurso) continue;
		await db
			.update(partidos)
			.set({ golesA: s.golesA, golesB: s.golesB, enCurso, fecha: new Date(ahora), autoMonitor: true })
			.where(eq(partidos.id, id));
		respaldados++;
	}

	return json({ ok: true, recibidos: matches.length, emparejados, sinEmparejar, respaldados });
};
