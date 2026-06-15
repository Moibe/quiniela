import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { participantes, partidos, pronosticos } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	// Atar el load a la navegación: datos en vivo frescos al llegar (sin recargar).
	void url.pathname;

	const [parts, mats, pros] = await Promise.all([
		db.select().from(participantes).orderBy(asc(participantes.posicion), asc(participantes.id)),
		db.select().from(partidos).orderBy(asc(partidos.numero)),
		db.select().from(pronosticos)
	]);

	// Partido(s) EN CURSO con su marcador provisional.
	const enCurso = mats
		.filter((m) => m.enCurso)
		.map((m) => ({
			numero: m.numero,
			equipoA: m.equipoA,
			equipoB: m.equipoB,
			real: m.golesA !== null && m.golesB !== null ? `${m.golesA}-${m.golesB}` : null
		}));

	// Gráfica de pastel: desglose local/empate/visitante de los pronósticos para el
	// partido EN CURSO; si no hay, el SIGUIENTE pendiente (primero por número).
	const objetivo = mats.find((m) => m.enCurso) ?? mats.find((m) => m.golesA === null);
	let grafica = null;
	if (objetivo) {
		const nombrePorId = new Map(parts.map((p) => [p.id, p.nombre]));
		const localNames: string[] = [];
		const empateNames: string[] = [];
		const visitaNames: string[] = [];
		for (const pr of pros) {
			if (pr.partidoId !== objetivo.id) continue;
			const nombre = nombrePorId.get(pr.participanteId) ?? '';
			if (pr.golesA > pr.golesB) localNames.push(nombre);
			else if (pr.golesA < pr.golesB) visitaNames.push(nombre);
			else empateNames.push(nombre);
		}
		const orden = (a: string, b: string) => a.localeCompare(b, 'es');
		localNames.sort(orden);
		empateNames.sort(orden);
		visitaNames.sort(orden);
		grafica = {
			numero: objetivo.numero,
			equipoA: objetivo.equipoA,
			equipoB: objetivo.equipoB,
			enCurso: objetivo.enCurso,
			local: localNames.length,
			empate: empateNames.length,
			visita: visitaNames.length,
			total: localNames.length + empateNames.length + visitaNames.length,
			localNames,
			empateNames,
			visitaNames
		};
	}

	return { grafica, enCurso };
};
