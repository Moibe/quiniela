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
import { partidos } from '$lib/server/db/schema';
import { getAllMonitorScores } from '$lib/server/monitorScores';
import { latidoRunner } from '$lib/server/monitorHeartbeat';
import { computeGrupos, type Grupo, type EquipoStanding } from '$lib/grupos';

export type FuenteEnVivo = 'monitor' | 'manual';
export type EstadoEnVivo = 'vivo' | 'desconectado' | 'terminado';

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
}

// Partido aún no jugado, para anunciar los "Próximos partidos" cuando no hay nada en vivo.
export interface ProximoEnVivo {
	numero: number;
	equipoA: string;
	equipoB: string;
	inicioMs: number | null; // hora de inicio (epoch) leída de Cloudbet por el monitor; null si no hay
}

export interface EnVivo {
	enCurso: PartidoEnVivo[];
	proximos: ProximoEnVivo[];
	grupos: Grupo[];
	terceros: TerceroEnVivo[];
}

const FRESCO_MS = 45_000; // refrescado hace menos ⇒ en vivo
const FIN_MS = 30 * 60_000; // partido terminado (runner vivo): se conserva 30 min y luego se quita
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
		}
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

	// Los 12 terceros, ordenados de mejor a peor (los 8 primeros llevan clasifica=true).
	const terceros: TerceroEnVivo[] = todosGrupos
		.map((g) => ({ grupo: g.label, s: g.equipos[2] }))
		.filter((x): x is { grupo: string; s: EquipoStanding } => !!x.s)
		.sort(
			(a, b) =>
				b.s.pts - a.s.pts || b.s.dg - a.s.dg || b.s.gf - a.s.gf || a.s.equipo.localeCompare(b.s.equipo, 'es')
		)
		.map(({ grupo, s }) => ({ grupo, equipo: s.equipo, pj: s.pj, dg: s.dg, pts: s.pts, clasifica: s.terceroClasifica }));

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

	return { enCurso, proximos, grupos, terceros };
}
