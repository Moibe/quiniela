// Fuente de datos de la página pública "En Vivo".
// Devuelve dos cosas:
//   • enCurso — los partidos del momento, uniendo el monitor y lo manual. Cada fila trae su `fuente`
//     ('monitor' | 'manual') y su `estado`:
//       - 'vivo'         → marcador en vivo (monitor fresco, o manual marcado a mano).
//       - 'desconectado' → el monitor se apagó: conservamos su ÚLTIMO marcador captado (atenuado),
//                          hasta que el runner vuelva, captures el final a mano, o caduque.
//     Si un partido cae en monitor+manual y el monitor está fresco, gana el monitor.
//   • grupos — tablas de los grupos involucrados, con el marcador del monitor (vivo o desconectado)
//     APLICADO encima de producción, para que la tabla refleje el partido aunque su marcador viva
//     solo en el sandbox.
//
// Distinción importante (vía el latido del runner): una lectura del monitor que dejó de refrescarse
// significa cosas distintas según si el runner sigue vivo:
//   - runner VIVO  → el partido simplemente terminó (Cloudbet lo sacó del in-play) ⇒ sale de la lista.
//   - runner CAÍDO → el monitor se apagó ⇒ conservamos el último marcador como 'desconectado'.
import { db } from '$lib/server/db';
import { partidos, q2Resultados } from '$lib/server/db/schema';
import { getAllMonitorScores } from '$lib/server/monitorScores';
import { latidoRunner } from '$lib/server/monitorHeartbeat';
import { computeGrupos, type Grupo, type EquipoStanding } from '$lib/grupos';
import { q2Juegos } from '$lib/q2Data';
import { Q2_ID_BASE } from '$lib/server/q2Live';

export type FuenteEnVivo = 'monitor' | 'manual';
export type EstadoEnVivo = 'vivo' | 'desconectado' | 'terminado' | 'porEmpezar';

export interface PartidoEnVivo {
	numero: number;
	equipoA: string;
	equipoB: string;
	golesA: number | null;
	golesB: number | null;
	fuente: FuenteEnVivo; // de dónde sale el marcador de ESTA fila
	estado: EstadoEnVivo;
	haceMs: number | null; // antigüedad de la última lectura si está 'desconectado'; null si 'vivo'
	minuto: string | null; // minuto del monitor (ej. "67'") si está 'vivo' por monitor; null si no
}

export interface TerceroEnVivo {
	grupo: string;
	equipo: string;
	pj: number;
	dg: number;
	pts: number;
	clasifica: boolean; // entre los mejores 8 terceros (clasifica a 2da ronda)
	enVivo: boolean; // su grupo tiene un partido EN CURSO (su posición puede cambiar ahora)
}

// Partido aún no jugado, para anunciar los "Próximos partidos" cuando no hay nada en vivo.
export interface ProximoEnVivo {
	numero: number;
	equipoA: string;
	equipoB: string;
	inicioMs: number | null; // hora de inicio (epoch) leída de Cloudbet por el monitor; null si no hay
}

// Juego de la Quiniela 2 EN VIVO (marcador del monitor en el sandbox; fuera de la fase de grupos).
export interface Q2EnVivo {
	etiqueta: string;
	equipoA: string;
	equipoB: string;
	golesA: number | null;
	golesB: number | null;
	estado: EstadoEnVivo;
	haceMs: number | null;
	minuto: string | null;
}

export interface EnVivo {
	enCurso: PartidoEnVivo[];
	proximos: ProximoEnVivo[];
	grupos: Grupo[];
	terceros: TerceroEnVivo[];
	q2EnCurso: Q2EnVivo[];
}

const FRESCO_MS = 45_000; // refrescado hace menos ⇒ en vivo
const FIN_MS = 30 * 60_000; // partido terminado (runner vivo): se conserva 30 min y luego se quita
const FIN_MANUAL_MS = 10 * 60_000; // final capturado A MANO: se queda "Finalizado" 10 min y luego se quita
const CADUCA_MS = 2 * 60 * 60_000; // monitor caído: "desconectado" hasta 2h (cubre un partido completo)

export async function partidosEnVivo(ahora: number): Promise<EnVivo> {
	const scores = getAllMonitorScores();
	const runnerVivo = latidoRunner(ahora).up;

	// Todos los partidos en una sola lectura (sirve para la lista en vivo Y para las tablas).
	const todos = await db
		.select({
			id: partidos.id,
			numero: partidos.numero,
			equipoA: partidos.equipoA,
			equipoB: partidos.equipoB,
			golesA: partidos.golesA,
			golesB: partidos.golesB,
			enCurso: partidos.enCurso,
			autoMonitor: partidos.autoMonitor,
			fecha: partidos.fecha,
			inicioCloudbet: partidos.inicioCloudbet
		})
		.from(partidos);

	const enCurso: PartidoEnVivo[] = [];
	// Marcadores a aplicar en las tablas de grupos (id → marcador + si pulsa "en vivo").
	const overlay = new Map<number, { golesA: number | null; golesB: number | null; enCurso: boolean }>();

	for (const p of todos) {
		const mon = scores.get(p.id);
		const edad = mon ? ahora - mon.ts : Infinity;
		const monVivo = !!mon && mon.enCurso && edad < FRESCO_MS;
		// Lectura del monitor que dejó de refrescarse (>45s). La distinguimos por el latido del runner:
		//   • runner VIVO  ⇒ el partido TERMINÓ (Cloudbet lo sacó del in-play). En vez de quitarlo de
		//     golpe, lo dejamos 30 min como "terminado" con su marcador final.
		//   • runner CAÍDO ⇒ el monitor se APAGÓ ⇒ "desconectado", hasta 2h.
		const monFin = !!mon && mon.enCurso && edad >= FRESCO_MS && edad < FIN_MS && runnerVivo;
		const monDesc = !!mon && mon.enCurso && edad >= FRESCO_MS && edad < CADUCA_MS && !runnerVivo;

		if (monVivo) {
			enCurso.push({
				numero: p.numero, equipoA: p.equipoA, equipoB: p.equipoB,
				golesA: mon!.golesA, golesB: mon!.golesB, fuente: 'monitor', estado: 'vivo', haceMs: null,
				minuto: mon!.minuto
			});
			overlay.set(p.id, { golesA: mon!.golesA, golesB: mon!.golesB, enCurso: true });
		} else if (p.enCurso && !p.autoMonitor) {
			// Provisional capturado A MANO (no el auto-respaldo del monitor, que es "transparente" aquí).
			enCurso.push({
				numero: p.numero, equipoA: p.equipoA, equipoB: p.equipoB,
				golesA: p.golesA, golesB: p.golesB, fuente: 'manual', estado: 'vivo', haceMs: null,
				minuto: null
			});
		} else if ((monFin || monDesc) && (p.golesA === null || p.autoMonitor)) {
			// Mostramos el del monitor salvo que haya un resultado HUMANO (ese manda y sale en Grupos).
			enCurso.push({
				numero: p.numero, equipoA: p.equipoA, equipoB: p.equipoB,
				golesA: mon!.golesA, golesB: mon!.golesB, fuente: 'monitor',
				estado: monFin ? 'terminado' : 'desconectado', haceMs: edad, minuto: null
			});
			overlay.set(p.id, { golesA: mon!.golesA, golesB: mon!.golesB, enCurso: false }); // cuenta, sin pulso
		} else if (
			!p.enCurso && !p.autoMonitor && p.golesA !== null && p.golesB !== null &&
			!!p.fecha && ahora - p.fecha.getTime() < FIN_MANUAL_MS
		) {
			// Resultado FINAL capturado A MANO hace poco: se queda como "Finalizado" 10 min, en vez de
			// desaparecer en el instante en que se marca el final. Su marcador ya está en la BD, así que
			// no necesita overlay para las tablas.
			enCurso.push({
				numero: p.numero, equipoA: p.equipoA, equipoB: p.equipoB,
				golesA: p.golesA, golesB: p.golesB, fuente: 'manual',
				estado: 'terminado', haceMs: ahora - p.fecha.getTime(), minuto: null
			});
		}
	}
	// "Por empezar": mantener visible al COMPAÑERO de un par simultáneo (impar↔par consecutivo) cuando
	// su pareja ya arrancó pero él sigue pendiente, hasta que también empiece. Evita que desaparezca
	// cuando solo uno del par cae en vivo (p. ej. el monitor cacha primero uno de los dos).
	const yaEnLista = new Set(enCurso.map((m) => m.numero));
	const porNumero = new Map(todos.map((p) => [p.numero, p]));
	for (const m of [...enCurso]) {
		if (m.estado !== 'vivo' && m.estado !== 'desconectado') continue;
		const parNum = m.numero % 2 === 1 ? m.numero + 1 : m.numero - 1;
		if (yaEnLista.has(parNum)) continue;
		const comp = porNumero.get(parNum);
		if (!comp || comp.enCurso || comp.golesA !== null) continue; // no existe, ya en curso, o ya jugado
		enCurso.push({
			numero: comp.numero, equipoA: comp.equipoA, equipoB: comp.equipoB,
			golesA: null, golesB: null, fuente: 'manual', estado: 'porEmpezar', haceMs: null, minuto: null
		});
		yaEnLista.add(parNum);
	}
	enCurso.sort((a, b) => a.numero - b.numero);

	// --- Grupos y tabla de terceros, con el marcador del monitor aplicado encima de producción ---
	const overlaid = todos.map((p) => {
		const ov = overlay.get(p.id);
		return ov
			? { numero: p.numero, equipoA: p.equipoA, equipoB: p.equipoB, golesA: ov.golesA, golesB: ov.golesB, enCurso: ov.enCurso }
			: { numero: p.numero, equipoA: p.equipoA, equipoB: p.equipoB, golesA: p.golesA, golesB: p.golesB, enCurso: p.enCurso };
	});
	const todosGrupos = computeGrupos(overlaid);

	// Puntos REALES (solo resultados finales): mismo cálculo pero tratando los partidos EN CURSO como
	// NO jugados. Se pega como `ptsReal` a cada equipo para mostrar dos columnas (reales vs tiempo real).
	const gruposReal = computeGrupos(
		overlaid.map((p) => (p.enCurso ? { ...p, golesA: null, golesB: null } : p))
	);
	const ptsRealDe = new Map<string, number>();
	for (const g of gruposReal) for (const e of g.equipos) ptsRealDe.set(e.equipo, e.pts);
	for (const g of todosGrupos) for (const e of g.equipos) e.ptsReal = ptsRealDe.get(e.equipo) ?? e.pts;

	// Los 12 terceros, ordenados de mejor a peor (los 8 primeros llevan clasifica=true).
	const terceros: TerceroEnVivo[] = todosGrupos
		.map((g) => ({ grupo: g.label, s: g.equipos[2] }))
		.filter((x): x is { grupo: string; s: EquipoStanding } => !!x.s)
		.sort(
			(a, b) =>
				b.s.pts - a.s.pts || b.s.dg - a.s.dg || b.s.gf - a.s.gf || a.s.equipo.localeCompare(b.s.equipo, 'es')
		)
		.map(({ grupo, s }) => ({ grupo, equipo: s.equipo, pj: s.pj, dg: s.dg, pts: s.pts, clasifica: s.terceroClasifica, enVivo: s.enVivo }));

	// Próximos partidos: los DOS siguientes pendientes (sin marcador y no en curso), por número de
	// calendario. Sirven para anunciar "Próximos partidos" cuando no hay nada en vivo.
	const enCursoNums = new Set(enCurso.map((m) => m.numero));
	const proximos: ProximoEnVivo[] = todos
		.filter((p) => p.golesA === null && !p.enCurso && !enCursoNums.has(p.numero))
		.sort((a, b) => a.numero - b.numero)
		.slice(0, 2)
		.map((p) => ({
			numero: p.numero,
			equipoA: p.equipoA,
			equipoB: p.equipoB,
			inicioMs: p.inicioCloudbet ? p.inicioCloudbet.getTime() : null
		}));

	// Tablas de grupo a mostrar: las de los partidos EN JUEGO; y si no hay nada en vivo, las de los
	// PRÓXIMOS (posiciones actuales del grupo, que pasan a actualizarse en vivo al arrancar el partido).
	const equiposVivos = new Set(enCurso.flatMap((m) => [m.equipoA, m.equipoB]));
	const equiposRelevantes = equiposVivos.size
		? equiposVivos
		: new Set(proximos.flatMap((m) => [m.equipoA, m.equipoB]));
	const grupos = equiposRelevantes.size
		? todosGrupos.filter((g) => g.equipos.some((e) => equiposRelevantes.has(e.equipo)))
		: [];

	// Juegos de la Quiniela 2 EN VIVO: su marcador vive SOLO en el sandbox (ids sintéticos, los empuja
	// el monitor). Aparte de la fase de grupos. Función reutilizable (sin DB) para /q2 y su poll.
	return { enCurso, proximos, grupos, terceros, q2EnCurso: q2EnVivo(ahora) };
}

// Marcadores EN VIVO de los juegos de la Quiniela 2 (solo del sandbox; misma frescura que el monitor).
export function q2EnVivo(ahora: number): Q2EnVivo[] {
	const scores = getAllMonitorScores();
	const runnerVivo = latidoRunner(ahora).up;
	const out: Q2EnVivo[] = [];
	q2Juegos.forEach((j, i) => {
		const mon = scores.get(Q2_ID_BASE + i);
		if (!mon || !mon.enCurso) return;
		const edad = ahora - mon.ts;
		const vivo = edad < FRESCO_MS;
		const fin = !vivo && edad < FIN_MS && runnerVivo;
		const desc = !vivo && edad >= FRESCO_MS && edad < CADUCA_MS && !runnerVivo;
		if (!vivo && !fin && !desc) return;
		out.push({
			etiqueta: j.etiqueta,
			equipoA: j.equipoA,
			equipoB: j.equipoB,
			golesA: mon.golesA,
			golesB: mon.golesB,
			estado: vivo ? 'vivo' : fin ? 'terminado' : 'desconectado',
			haceMs: vivo ? null : edad,
			minuto: vivo ? mon.minuto : null
		});
	});
	return out;
}

// Resultado EFECTIVO de cada juego de Q2, para colorear /q2 y mostrarlo en Partidos: parte del marcador
// MANUAL persistido (lo captura el admin en /q2, tabla `q2_resultados`) y le SOBREPONE el marcador EN
// VIVO del monitor (sandbox) mientras el juego está en curso. Misma regla que los partidos: en vivo
// manda; ya terminado, queda el manual. Solo devuelve los juegos que tienen algún resultado.
export async function q2Efectivo(ahora: number): Promise<Q2EnVivo[]> {
	const vivos = new Map(q2EnVivo(ahora).map((r) => [r.etiqueta, r] as const));
	const manuales = await db.select().from(q2Resultados);
	const manualPorEtiqueta = new Map(manuales.map((m) => [m.etiqueta, m] as const));
	const out: Q2EnVivo[] = [];
	for (const j of q2Juegos) {
		const vivo = vivos.get(j.etiqueta);
		if (vivo) {
			out.push(vivo); // el monitor está activo en este juego ⇒ su marcador manda
			continue;
		}
		const m = manualPorEtiqueta.get(j.etiqueta);
		if (!m || m.golesA == null || m.golesB == null) continue; // sin resultado capturado
		out.push({
			etiqueta: j.etiqueta,
			equipoA: j.equipoA,
			equipoB: j.equipoB,
			golesA: m.golesA,
			golesB: m.golesB,
			estado: m.enCurso ? 'vivo' : 'terminado', // en vivo capturado a mano ⇒ pulsa; final ⇒ queda fijo
			haceMs: null,
			minuto: null
		});
	}
	return out;
}
