import { error } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import { getProbe } from '$lib/server/probe';
import { getMonitorScore } from '$lib/server/monitorScores';
import { latidoRunner } from '$lib/server/monitorHeartbeat';
import type { PageServerLoad } from './$types';

// Labs es SOLO para administración: sin sesión de admin la página "no existe"
// (mismo criterio con el que se oculta el resto del área de admin). Esto protege
// la ruta aunque alguien la teclee directo, no solo escondiendo el menú.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.isAdmin) error(404, 'Página no existe');

	// Los 72 partidos con su config de monitoreo + marcador actual, para sembrar
	// la tabla de configuración y el display en vivo (que luego se refresca por poll).
	const lista = await db
		.select({
			id: partidos.id,
			numero: partidos.numero,
			equipoA: partidos.equipoA,
			equipoB: partidos.equipoB,
			golesA: partidos.golesA,
			golesB: partidos.golesB,
			enCurso: partidos.enCurso,
			urlCloudbet: partidos.urlCloudbet,
			monitorear: partidos.monitorear
		})
		.from(partidos)
		.orderBy(asc(partidos.numero));

	// Display en vivo: marcadores del SANDBOX del monitor (en memoria), NO de producción.
	const vivo = lista
		.filter((p) => p.monitorear)
		.map((p) => {
			const s = getMonitorScore(p.id);
			return {
				id: p.id,
				numero: p.numero,
				equipoA: p.equipoA,
				equipoB: p.equipoB,
				golesA: s?.golesA ?? null,
				golesB: s?.golesB ?? null,
				enCurso: s?.enCurso ?? false
			};
		});

	// `probe`: sandbox del Probador; `runner`: si el runner local está vivo (latido). Ambos en memoria.
	return { partidos: lista, probe: getProbe(), vivo, runner: latidoRunner(Date.now()) };
};
