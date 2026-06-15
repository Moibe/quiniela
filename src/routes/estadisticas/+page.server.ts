import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { participantes, partidos, pronosticos } from '$lib/server/db/schema';
import { puntosDe, PUNTOS_EXACTO, computeStandings } from '$lib/scoring';
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

	// Tarjetas de "ganadores" para el OBJETIVO (el partido en curso o, si no hay, el
	// siguiente pendiente): quién GANARÍA puntos con un marcador dado. Exacto (3 pts)
	// hasta arriba, luego acierto de resultado (1 pt); los que fallan no se listan.
	// Si el partido aún no empieza, se asume 0-0 de salida para tener estadísticas
	// desde antes. Se calculan con el marcador del objetivo y los escenarios
	// "+1 gol local" / "+1 gol visita".
	let ganando = null;
	let golLocal = null;
	let golVisita = null;
	let pendiente = false; // true = el objetivo aún no empieza (tarjetas asumen 0-0)
	if (objetivo) {
		const nombrePorId = new Map(parts.map((p) => [p.id, p.nombre]));
		const prosObj = pros.filter((pr) => pr.partidoId === objetivo.id);
		const ga = objetivo.golesA ?? 0; // 0-0 por defecto si todavía no hay marcador
		const gb = objetivo.golesB ?? 0;
		pendiente = !objetivo.enCurso;

		// Tabla BASE: cómo estaría la clasificación SIN contar este partido. Sirve de
		// referencia para medir cuántos lugares subiría cada quien si terminara con un
		// marcador dado (mismo ranking que Lugares).
		const matsSinObj = mats.map((m) =>
			m.id === objetivo.id ? { ...m, golesA: null, golesB: null } : m
		);
		const baseRank = new Map(
			computeStandings(parts, matsSinObj, pros).standings.map((s) => [s.participanteId, s.rank])
		);

		const tarjeta = (golesA: number, golesB: number) => {
			// Ranking si el partido terminara con ESTE marcador.
			const matsCon = matsSinObj.map((m) =>
				m.id === objetivo.id ? { ...m, golesA, golesB } : m
			);
			const escenRank = new Map(
				computeStandings(parts, matsCon, pros).standings.map((s) => [s.participanteId, s.rank])
			);

			const lista: {
				nombre: string;
				pronostico: string;
				puntos: number;
				exacto: boolean;
				mov: number;
			}[] = [];
			for (const pr of prosObj) {
				const pts = puntosDe({ golesA: pr.golesA, golesB: pr.golesB }, { golesA, golesB });
				if (pts > 0) {
					// + = sube lugares (su rank baja de número) respecto a la tabla base.
					const mov =
						(baseRank.get(pr.participanteId) ?? 0) - (escenRank.get(pr.participanteId) ?? 0);
					lista.push({
						nombre: nombrePorId.get(pr.participanteId) ?? '',
						pronostico: `${pr.golesA}-${pr.golesB}`,
						puntos: pts,
						exacto: pts === PUNTOS_EXACTO,
						mov
					});
				}
			}
			lista.sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre, 'es'));
			return {
				numero: objetivo.numero,
				equipoA: objetivo.equipoA,
				equipoB: objetivo.equipoB,
				real: `${golesA}-${golesB}`,
				lista,
				exactos: lista.filter((x) => x.exacto).length,
				resultados: lista.filter((x) => !x.exacto).length
			};
		};

		ganando = tarjeta(ga, gb); // marcador actual (o 0-0 si aún no empieza)
		golLocal = tarjeta(ga + 1, gb); // si anota el local
		golVisita = tarjeta(ga, gb + 1); // si anota la visita
	}

	return { grafica, enCurso, ganando, golLocal, golVisita, pendiente };
};
