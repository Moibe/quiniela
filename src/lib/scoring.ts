// Reglas de puntaje de la quiniela:
//  - 3 puntos por marcador EXACTO.
//  - 1 punto por acertar el RESULTADO (ganador o empate), sin marcador exacto.
//  - 0 si ni el resultado coincide.
// (Exacto y resultado son excluyentes: un exacto da 3, no 3+1.)
export const PUNTOS_EXACTO = 3;
export const PUNTOS_RESULTADO = 1;

type ParticipanteIn = { id: number; nombre: string };
type PartidoIn = { id: number; golesA: number | null; golesB: number | null };
type PronosticoIn = {
	partidoId: number;
	participanteId: number;
	golesA: number;
	golesB: number;
};

export type Standing = {
	participanteId: number;
	nombre: string;
	puntos: number;
	exactos: number;
	resultados: number;
	fallados: number;
	rank: number;
};

// Dirección del marcador: 1 gana A, 0 empate, -1 gana B.
const signo = (a: number, b: number): number => Math.sign(a - b);

export function puntosDe(
	prono: { golesA: number; golesB: number },
	real: { golesA: number; golesB: number }
): number {
	if (prono.golesA === real.golesA && prono.golesB === real.golesB) return PUNTOS_EXACTO;
	if (signo(prono.golesA, prono.golesB) === signo(real.golesA, real.golesB)) return PUNTOS_RESULTADO;
	return 0;
}

export function computeStandings(
	participantes: ParticipanteIn[],
	partidos: PartidoIn[],
	pronosticos: PronosticoIn[]
): { standings: Standing[]; partidosJugados: number } {
	// Resultados reales por partido (solo los ya jugados).
	const reales = new Map<number, { golesA: number; golesB: number }>();
	for (const p of partidos) {
		if (p.golesA !== null && p.golesB !== null) {
			reales.set(p.id, { golesA: p.golesA, golesB: p.golesB });
		}
	}

	const acc = new Map<number, { puntos: number; exactos: number; resultados: number; fallados: number }>();
	for (const par of participantes) {
		acc.set(par.id, { puntos: 0, exactos: 0, resultados: 0, fallados: 0 });
	}

	for (const pr of pronosticos) {
		const real = reales.get(pr.partidoId);
		if (!real) continue; // partido aún sin resultado
		const a = acc.get(pr.participanteId);
		if (!a) continue;
		const pts = puntosDe(pr, real);
		a.puntos += pts;
		if (pts === PUNTOS_EXACTO) a.exactos++;
		else if (pts === PUNTOS_RESULTADO) a.resultados++;
		else a.fallados++;
	}

	const standings: Standing[] = participantes.map((par) => {
		const a = acc.get(par.id)!;
		return {
			participanteId: par.id,
			nombre: par.nombre,
			puntos: a.puntos,
			exactos: a.exactos,
			resultados: a.resultados,
			fallados: a.fallados,
			rank: 0
		};
	});

	// Orden: puntos desc, luego más exactos, luego más resultados, luego nombre.
	standings.sort(
		(x, y) =>
			y.puntos - x.puntos ||
			y.exactos - x.exactos ||
			y.resultados - x.resultados ||
			x.nombre.localeCompare(y.nombre, 'es')
	);

	// Ranking de competencia: empates en PUNTOS comparten posición (1,1,3,…).
	standings.forEach((s, i) => {
		s.rank = i > 0 && s.puntos === standings[i - 1].puntos ? standings[i - 1].rank : i + 1;
	});

	return { standings, partidosJugados: reales.size };
}
