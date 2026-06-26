// Arma el cuadro OFICIAL de dieciseisavos (Round of 32, partidos 73–88) del
// Mundial 2026 SEGÚN los pronósticos de un participante. No hay pronósticos de
// eliminatoria en la base: usamos los 72 marcadores que predijo esa persona como
// si fueran los resultados de la fase de grupos, calculamos las tablas y de ahí
// aplicamos el cuadro FIJO predeterminado por FIFA — NO un sorteo ni una siembra.
//
// Reglas oficiales (Reglamento FIFA Mundial 2026):
//   • 12 grupos (A–L) de 4. Avanzan los 2 primeros de cada grupo (24) + los 8
//     mejores terceros de 12 (criterio: pts, dif. de goles, goles a favor…).
//   • El cuadro de dieciseisavos es FIJO por posición. Patrón: 4 cruces 1º-vs-2º,
//     8 cruces 1º-vs-mejor 3º, 4 cruces 2º-vs-2º (ver PLANTILLA abajo).
//   • A qué llave va cada uno de los 8 terceros lo define la tabla "Annex C"
//     (495 combinaciones) según DE QUÉ grupos salieron esos terceros: ANNEX_C.
import { computeGrupos, type EquipoStanding } from './grupos';
import { ANNEX_C, TERCEROS_SLOTS } from './terceros-annexC';

type PartidoIn = {
	id: number;
	numero: number;
	equipoA: string;
	equipoB: string;
	golesA: number | null;
	golesB: number | null;
};

type PronoIn = {
	partidoId: number;
	participanteId: number;
	golesA: number;
	golesB: number;
};

export type Clasificado = {
	equipo: string;
	origen: string; // "1° A", "2° C", "3° E"
	grupo: string;
	pts: number;
	dg: number;
	gf: number;
	tercero: boolean; // clasificó como uno de los 8 mejores terceros
};

export type Cruce = {
	numero: number; // partido oficial 73–88
	llave: number; // 1–16 (orden de presentación)
	a: Clasificado;
	b: Clasificado;
	confirmado: boolean; // el cruce YA no puede cambiar (ambos lados fijos) — ver armarCruces
};

// Plantilla FIJA oficial de los 16 dieciseisavos (partidos 73–88). Cada lado es
// una posición predeterminada: "1X"=ganador del grupo X, "2X"=segundo del grupo X,
// "3@X"=el mejor tercero que la tabla Annex C asigna al ganador del grupo X.
const PLANTILLA: { numero: number; a: string; b: string }[] = [
	{ numero: 73, a: '2A', b: '2B' },
	{ numero: 74, a: '1E', b: '3@E' },
	{ numero: 75, a: '1F', b: '2C' },
	{ numero: 76, a: '1C', b: '2F' },
	{ numero: 77, a: '1I', b: '3@I' },
	{ numero: 78, a: '2E', b: '2I' },
	{ numero: 79, a: '1A', b: '3@A' },
	{ numero: 80, a: '1L', b: '3@L' },
	{ numero: 81, a: '1D', b: '3@D' },
	{ numero: 82, a: '1G', b: '3@G' },
	{ numero: 83, a: '2K', b: '2L' },
	{ numero: 84, a: '1H', b: '2J' },
	{ numero: 85, a: '1B', b: '3@B' },
	{ numero: 86, a: '1J', b: '2H' },
	{ numero: 87, a: '1K', b: '3@K' },
	{ numero: 88, a: '2D', b: '2G' }
];

// Comparador de terceros (mejor primero): pts, dif. de goles, goles a favor; el
// nombre solo desempata para que el orden sea determinista (no hay fair-play ni
// ranking FIFA en la base).
const rank = (x: EquipoStanding, y: EquipoStanding) =>
	y.pts - x.pts || y.dg - x.dg || y.gf - x.gf || x.equipo.localeCompare(y.equipo, 'es');

export function computeBracket(
	partidos: PartidoIn[],
	pronosticos: PronoIn[],
	participanteId: number
): Cruce[] {
	// Marcadores pronosticados por esta persona, por partido.
	const pred = new Map<number, { golesA: number; golesB: number }>();
	for (const pr of pronosticos) {
		if (pr.participanteId === participanteId) {
			pred.set(pr.partidoId, { golesA: pr.golesA, golesB: pr.golesB });
		}
	}

	// Partidos "virtuales": el resultado = lo que predijo la persona.
	const virtual = partidos.map((p) => {
		const v = pred.get(p.id);
		return { ...p, golesA: v ? v.golesA : null, golesB: v ? v.golesB : null };
	});

	return armarCruces(virtual);
}

// Igual que computeBracket pero con los RESULTADOS REALES capturados: arma el
// cuadro tal como va "hasta ahora". Los partidos sin marcador no aportan puntos;
// los equipos aún empatados (incluidos los que no han jugado) se ordenan por los
// criterios oficiales y, a falta de juego, por nombre —igual que las tablas de
// grupos—, así que el cuadro es provisional y cambia con cada resultado.
export function computeBracketReal(partidos: PartidoIn[]): Cruce[] {
	return armarCruces(partidos);
}

// Núcleo compartido: dada una lista de partidos con (o sin) marcador, calcula los
// grupos y arma los 16 cruces oficiales (plantilla fija 73–88 + Annex C).
function armarCruces(partidosConResultado: PartidoIn[]): Cruce[] {
	const grupos = computeGrupos(partidosConResultado);
	const byLabel = new Map(grupos.map((g) => [g.label, g]));

	// 8 mejores terceros (de 12) y de qué grupos vienen.
	const terceros = grupos
		.map((g) => ({ label: g.label, st: g.equipos[2] }))
		.filter((t): t is { label: string; st: EquipoStanding } => !!t.st);
	const mejoresLabels = terceros
		.slice()
		.sort((a, b) => rank(a.st, b.st))
		.slice(0, 8)
		.map((t) => t.label);

	// Clave Annex C: las 8 letras (ordenadas) cuyos terceros clasifican.
	const key = mejoresLabels.slice().sort().join('');
	const asignacion = ANNEX_C[key];

	// Camino oficial: requiere los 12 grupos y una entrada válida en Annex C
	// (siempre se cumple con la estructura de 72 partidos / 12 grupos).
	if (grupos.length === 12 && mejoresLabels.length === 8 && asignacion) {
		// Para cada ganador-de-grupo que enfrenta a un tercero: el grupo de ese tercero.
		const terceroDe = new Map<string, string>();
		TERCEROS_SLOTS.forEach((w, i) => terceroDe.set(w, asignacion[i]));

		const resolver = (ref: string): Clasificado => {
			if (ref.startsWith('3@')) {
				const w = ref.slice(2); // ganador de grupo (A, B, D, …)
				const gl = terceroDe.get(w)!; // grupo del tercero asignado
				return toClas(byLabel.get(gl)!.equipos[2], `3° ${gl}`, gl, true);
			}
			const pos = Number(ref[0]); // 1 o 2
			const gl = ref.slice(1);
			return toClas(byLabel.get(gl)!.equipos[pos - 1], `${pos}° ${gl}`, gl, false);
		};

		// Grupos ya terminados (6/6) y si TODOS lo están. Un cruce está CONFIRMADO (no puede cambiar)
		// cuando ambos lados son fijos: un slot 1°/2° queda fijo al terminar SU grupo; un slot de mejor
		// 3° solo queda fijo cuando terminaron TODOS los grupos (ahí se cierra qué 8 terceros clasifican
		// y a qué llave va cada uno por Annex C; antes puede reordenarse con cualquier resultado).
		const completos = new Set(grupos.filter((g) => g.partidosJugados === 6).map((g) => g.label));
		const todosCompletos = completos.size === grupos.length;
		const slotFijo = (c: Clasificado) => (c.tercero ? todosCompletos : completos.has(c.grupo));

		return PLANTILLA.map((m, i) => {
			const a = resolver(m.a);
			const b = resolver(m.b);
			return { numero: m.numero, llave: i + 1, a, b, confirmado: slotFijo(a) && slotFijo(b) };
		});
	}

	// Fallback defensivo (datos incompletos / grupos != 12): cuadro vacío en vez
	// de inventar cruces. Con la quiniela completa nunca debería llegar aquí.
	return [];
}

function toClas(s: EquipoStanding, origen: string, grupo: string, tercero: boolean): Clasificado {
	return { equipo: s.equipo, origen, grupo, pts: s.pts, dg: s.dg, gf: s.gf, tercero };
}
