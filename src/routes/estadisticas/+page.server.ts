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

	// Para el partido EN CURSO (el primero, si hay varios): quién GANARÍA puntos con
	// un marcador dado. Marcador exacto (3 pts) hasta arriba, luego acierto de
	// resultado (1 pt); los que fallan (0 pts) no se listan. Se calcula con el
	// marcador VIGENTE y con los escenarios "+1 gol local" / "+1 gol visita".
	const vivo = mats.find((m) => m.enCurso && m.golesA !== null && m.golesB !== null);
	let ganando = null;
	let golLocal = null;
	let golVisita = null;
	if (vivo) {
		const nombrePorId = new Map(parts.map((p) => [p.id, p.nombre]));
		const prosVivo = pros.filter((pr) => pr.partidoId === vivo.id);
		const ga = vivo.golesA as number;
		const gb = vivo.golesB as number;

		// Tabla BASE: cómo estaría la clasificación SIN contar el partido en curso.
		// Sirve de referencia para medir cuántos lugares subiría/bajaría cada quien
		// si el partido terminara con un marcador dado (mismo ranking que Lugares).
		const matsSinVivo = mats.map((m) =>
			m.id === vivo.id ? { ...m, golesA: null, golesB: null } : m
		);
		const baseRank = new Map(
			computeStandings(parts, matsSinVivo, pros).standings.map((s) => [s.participanteId, s.rank])
		);

		const tarjeta = (golesA: number, golesB: number) => {
			// Ranking si el partido en curso terminara con ESTE marcador.
			const matsCon = matsSinVivo.map((m) => (m.id === vivo.id ? { ...m, golesA, golesB } : m));
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
			for (const pr of prosVivo) {
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
				numero: vivo.numero,
				equipoA: vivo.equipoA,
				equipoB: vivo.equipoB,
				real: `${golesA}-${golesB}`,
				lista,
				exactos: lista.filter((x) => x.exacto).length,
				resultados: lista.filter((x) => !x.exacto).length
			};
		};

		ganando = tarjeta(ga, gb); // marcador vigente
		golLocal = tarjeta(ga + 1, gb); // si anota el local
		golVisita = tarjeta(ga, gb + 1); // si anota la visita
	}

	return { grafica, enCurso, ganando, golLocal, golVisita };
};
