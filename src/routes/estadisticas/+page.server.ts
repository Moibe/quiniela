import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { participantes, partidos, pronosticos } from '$lib/server/db/schema';
import { puntosDe, PUNTOS_EXACTO, computeStandings } from '$lib/scoring';
import { computeGrupos } from '$lib/grupos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, depends }) => {
	// Atar el load a la navegación (datos frescos al llegar) y a una clave invalidable para el
	// auto-refresco del marcador en vivo: el front llama invalidate('estad:live') cada ~10s.
	void url.pathname;
	depends('estad:live');

	const [parts, mats, pros] = await Promise.all([
		db.select().from(participantes).orderBy(asc(participantes.posicion), asc(participantes.id)),
		db.select().from(partidos).orderBy(asc(partidos.numero)),
		db.select().from(pronosticos)
	]);

	// Partido(s) EN CURSO con su marcador provisional (banner).
	const enCurso = mats
		.filter((m) => m.enCurso)
		.map((m) => ({
			numero: m.numero,
			equipoA: m.equipoA,
			equipoB: m.equipoB,
			real: m.golesA !== null && m.golesB !== null ? `${m.golesA}-${m.golesB}` : null
		}));

	// Mapa equipo → grupo, para confirmar que el par de la jornada final es del MISMO grupo.
	const grupoDe = new Map<string, string>();
	for (const g of computeGrupos(mats)) for (const e of g.equipos) grupoDe.set(e.equipo, g.label);

	// Objetivo(s): los partidos NO finalizados (en curso o pendientes), por número. En la jornada
	// final hay DOS simultáneos: si los dos siguientes son del MISMO grupo, mostramos ambos; si no
	// (jornada normal, uno a la vez), mostramos solo el siguiente.
	const candidatos = mats.filter((m) => m.enCurso || m.golesA === null); // mats ya viene por número
	const [c0, c1] = candidatos;
	const esPar =
		!!c0 && !!c1 && !!grupoDe.get(c0.equipoA) && grupoDe.get(c0.equipoA) === grupoDe.get(c1.equipoA);
	const objetivos = esPar ? [c0, c1] : c0 ? [c0] : [];

	const nombrePorId = new Map(parts.map((p) => [p.id, p.nombre]));

	// Calcula el bloque de estadísticas (pastel + tarjetas de escenarios) de UN partido objetivo.
	function computeBloque(objetivo: (typeof mats)[number]) {
		// Pastel: desglose local/empate/visitante de los pronósticos para este partido.
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
		const grafica = {
			numero: objetivo.numero,
			equipoA: objetivo.equipoA,
			equipoB: objetivo.equipoB,
			enCurso: objetivo.enCurso,
			golesA: objetivo.golesA, // marcador real (null si aún no inicia → se muestra 0–0 de salida)
			golesB: objetivo.golesB,
			local: localNames.length,
			empate: empateNames.length,
			visita: visitaNames.length,
			total: localNames.length + empateNames.length + visitaNames.length,
			localNames,
			empateNames,
			visitaNames
		};

		// Tarjetas de "ganadores": quién GANARÍA puntos con un marcador dado (3 pts exacto arriba,
		// luego 1 pt). Si aún no empieza, se asume 0-0 de salida. Escenarios: actual, +1 local, +1 visita.
		const prosObj = pros.filter((pr) => pr.partidoId === objetivo.id);
		const ga = objetivo.golesA ?? 0;
		const gb = objetivo.golesB ?? 0;
		const pendiente = !objetivo.enCurso;

		// Tabla BASE: clasificación SIN contar este partido, para medir cuánto subiría cada quien.
		const matsSinObj = mats.map((m) =>
			m.id === objetivo.id ? { ...m, golesA: null, golesB: null } : m
		);
		const baseRank = new Map(
			computeStandings(parts, matsSinObj, pros).standings.map((s) => [s.participanteId, s.rank])
		);

		const tarjeta = (golesA: number, golesB: number) => {
			const matsCon = matsSinObj.map((m) =>
				m.id === objetivo.id ? { ...m, golesA, golesB } : m
			);
			const escenStandings = computeStandings(parts, matsCon, pros).standings;
			const escenRank = new Map(escenStandings.map((s) => [s.participanteId, s.rank]));
			const escenPuntos = new Map(escenStandings.map((s) => [s.participanteId, s.puntos]));

			const lista: {
				nombre: string;
				pronostico: string;
				puntos: number;
				exacto: boolean;
				mov: number;
				lugar: number;
				total: number;
			}[] = [];
			for (const pr of prosObj) {
				const pts = puntosDe({ golesA: pr.golesA, golesB: pr.golesB }, { golesA, golesB });
				if (pts > 0) {
					const mov =
						(baseRank.get(pr.participanteId) ?? 0) - (escenRank.get(pr.participanteId) ?? 0);
					lista.push({
						nombre: nombrePorId.get(pr.participanteId) ?? '',
						pronostico: `${pr.golesA}-${pr.golesB}`,
						puntos: pts,
						exacto: pts === PUNTOS_EXACTO,
						mov,
						lugar: escenRank.get(pr.participanteId) ?? 0,
						total: escenPuntos.get(pr.participanteId) ?? 0
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

		return {
			numero: objetivo.numero,
			equipoA: objetivo.equipoA,
			equipoB: objetivo.equipoB,
			enCurso: objetivo.enCurso,
			pendiente,
			grafica,
			ganando: tarjeta(ga, gb),
			golLocal: tarjeta(ga + 1, gb),
			golVisita: tarjeta(ga, gb + 1)
		};
	}

	// 1 bloque (jornada normal) o 2 (jornada final: par simultáneo del mismo grupo, 50-50).
	const bloques = objetivos.map(computeBloque);

	return { bloques, enCurso };
};
