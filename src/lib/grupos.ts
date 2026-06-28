// Deriva los grupos del Mundial a partir de los 72 partidos y calcula la tabla
// de posiciones REAL de cada grupo (con los marcadores capturados).
//
// No hay columna "grupo" en la base: cada grupo de 4 equipos juega sus 6 parejas
// (round-robin), formando un grafo completo K4. Las componentes conexas del grafo
// equipo↔equipo son exactamente los grupos. Los grupos se etiquetan A, B, C…
// según el número de partido más bajo de cada uno.

type PartidoIn = {
	numero: number;
	equipoA: string;
	equipoB: string;
	golesA: number | null;
	golesB: number | null;
	enCurso?: boolean;
};

export type EquipoStanding = {
	equipo: string;
	pj: number; // partidos jugados
	g: number; // ganados
	e: number; // empatados
	p: number; // perdidos
	gf: number; // goles a favor
	gc: number; // goles en contra
	dg: number; // diferencia de goles
	pts: number; // puntos (en En Vivo, EN TIEMPO REAL: incluye el marcador en curso)
	ptsReal?: number; // puntos SOLO con resultados finales; lo pega En Vivo para la columna "reales"
	pos: number; // posición en el grupo (1..4)
	enVivo: boolean; // está jugando ahora (partido en curso)
	terceroClasifica: boolean; // 3er lugar que va entre los mejores 8 terceros (clasifica)
};

export type Grupo = {
	label: string; // "A", "B", …
	equipos: EquipoStanding[];
	partidosJugados: number; // de 6
};

// Letra OFICIAL de grupo del Mundial 2026 por el equipo sembrado (Pot 1) que
// cada grupo contiene. Cada uno de los 12 grupos tiene exactamente un equipo de
// Pot 1 (los 3 anfitriones + los 9 mejores del ranking), así que ese equipo
// identifica el grupo sin ambigüedad y fija la letra real (no la del orden en
// que se capturaron los partidos). Verificado contra el sorteo oficial.
const GRUPO_OFICIAL: Record<string, string> = {
	'México': 'A',
	'Canadá': 'B',
	'Brasil': 'C',
	'E. Unidos': 'D',
	'Alemania': 'E',
	'P. Bajos': 'F',
	'España': 'G',
	'Bélgica': 'H',
	'Francia': 'I',
	'Argentina': 'J',
	'Portugal': 'K',
	'Inglaterra': 'L'
};

// Partido jugado ENTRE dos equipos del mismo grupo (para el desempate head-to-head).
type GM = { a: string; b: string; ga: number; gb: number };

// Mini-tabla head-to-head (pts/dg/gf) de un conjunto de equipos, contando SOLO los partidos jugados
// entre ellos.
function h2hMini(teams: EquipoStanding[], matches: GM[]): Map<string, { pts: number; dg: number; gf: number }> {
	const set = new Set(teams.map((e) => e.equipo));
	const h = new Map(teams.map((e) => [e.equipo, { pts: 0, dg: 0, gf: 0 }]));
	for (const m of matches) {
		if (!set.has(m.a) || !set.has(m.b)) continue;
		const A = h.get(m.a)!;
		const B = h.get(m.b)!;
		A.gf += m.ga;
		B.gf += m.gb;
		A.dg += m.ga - m.gb;
		B.dg += m.gb - m.ga;
		if (m.ga > m.gb) A.pts += 3;
		else if (m.ga < m.gb) B.pts += 3;
		else {
			A.pts += 1;
			B.pts += 1;
		}
	}
	return h;
}

// Desempata equipos EMPATADOS EN PUNTOS con la regla oficial FIFA: head-to-head (pts, dif. de goles
// y goles SOLO entre ellos). Si tras el head-to-head un SUBCONJUNTO sigue empatado, la regla se
// RE-APLICA solo entre esos equipos (recursivo: para 2 equipos eso es su partido directo). Cuando ya
// no se puede separar por head-to-head, se cae a dif. de goles general → goles general → nombre (el
// fair-play y el ranking FIFA no están en la base; el nombre es el último recurso determinista).
function desempatar(teams: EquipoStanding[], matches: GM[]): EquipoStanding[] {
	if (teams.length <= 1) return [...teams];
	const h = h2hMini(teams, matches);
	const ordenados = [...teams].sort((x, y) => {
		const hx = h.get(x.equipo)!;
		const hy = h.get(y.equipo)!;
		return hy.pts - hx.pts || hy.dg - hx.dg || hy.gf - hx.gf;
	});
	// Agrupa en corridas con los MISMOS valores head-to-head (pts/dg/gf).
	const corridas: EquipoStanding[][] = [];
	for (const e of ordenados) {
		const he = h.get(e.equipo)!;
		const ult = corridas[corridas.length - 1];
		const hu = ult ? h.get(ult[0].equipo)! : null;
		if (hu && hu.pts === he.pts && hu.dg === he.dg && hu.gf === he.gf) ult!.push(e);
		else corridas.push([e]);
	}

	const out: EquipoStanding[] = [];
	for (const corrida of corridas) {
		if (corrida.length === 1) {
			out.push(corrida[0]);
		} else if (corrida.length < teams.length) {
			// El head-to-head separó parte del bloque: re-aplícalo SOLO entre los que siguen empatados.
			out.push(...desempatar(corrida, matches));
		} else {
			// No se pudo separar por head-to-head (todos iguales entre sí): dg general → gf → nombre.
			out.push(
				...[...corrida].sort(
					(x, y) => y.dg - x.dg || y.gf - x.gf || x.equipo.localeCompare(y.equipo, 'es')
				)
			);
		}
	}
	return out;
}

// Orden oficial FIFA 2026 dentro de un grupo: por puntos (desc) y, para cada bloque de equipos con
// los mismos puntos, el desempate head-to-head (recursivo). `matches` = los partidos jugados de ESTE
// grupo. Orden: puntos → h2h(pts, dg, gf) [re-aplicado al subconjunto que siga empatado] → dg
// general → gf general → nombre.
function ordenarGrupoFIFA(equipos: EquipoStanding[], matches: GM[]): EquipoStanding[] {
	const porPuntos = [...equipos].sort((a, b) => b.pts - a.pts);
	const bloques: EquipoStanding[][] = [];
	for (const e of porPuntos) {
		const ult = bloques[bloques.length - 1];
		if (ult && ult[0].pts === e.pts) ult.push(e);
		else bloques.push([e]);
	}
	return bloques.flatMap((bloque) => desempatar(bloque, matches));
}

export function computeGrupos(partidos: PartidoIn[]): Grupo[] {
	// 1) Componentes conexas (cada grupo = K4) del grafo de enfrentamientos.
	const adj = new Map<string, Set<string>>();
	const link = (a: string, b: string) => {
		if (!adj.has(a)) adj.set(a, new Set());
		adj.get(a)!.add(b);
	};
	for (const p of partidos) {
		link(p.equipoA, p.equipoB);
		link(p.equipoB, p.equipoA);
	}

	const visto = new Set<string>();
	const comps: string[][] = [];
	for (const inicio of adj.keys()) {
		if (visto.has(inicio)) continue;
		const pila = [inicio];
		const comp: string[] = [];
		while (pila.length) {
			const n = pila.pop()!;
			if (visto.has(n)) continue;
			visto.add(n);
			comp.push(n);
			for (const m of adj.get(n)!) if (!visto.has(m)) pila.push(m);
		}
		comps.push(comp);
	}

	// 2) Etiqueta cada grupo. Preferimos la letra OFICIAL (por el equipo sembrado
	//    de Pot 1 que contiene), de modo que el orden cronológico de captura no
	//    altere las letras (el grupo de Brasil siempre es C, etc.). Si no se
	//    reconocen los 12 sembrados (datos atípicos), caemos a etiquetar A..L por
	//    el número de partido más bajo de cada grupo (orden estable).
	const minNumero = (teams: string[]) => {
		let min = Infinity;
		for (const p of partidos) {
			if (teams.includes(p.equipoA) && teams.includes(p.equipoB)) min = Math.min(min, p.numero);
		}
		return min;
	};

	const oficiales = comps.map((teams) => {
		const sembrado = teams.find((t) => GRUPO_OFICIAL[t]);
		return sembrado ? GRUPO_OFICIAL[sembrado] : null;
	});
	const usarOficial =
		oficiales.every((l) => l !== null) && new Set(oficiales).size === comps.length;

	const etiquetados = usarOficial
		? comps.map((teams, i) => ({ teams, label: oficiales[i] as string }))
		: [...comps]
				.sort((a, b) => minNumero(a) - minNumero(b))
				.map((teams, i) => ({ teams, label: String.fromCharCode(65 + i) }));
	etiquetados.sort((a, b) => a.label.localeCompare(b.label));

	// 3) Tabla de cada grupo con los marcadores ya capturados.
	const grupos = etiquetados.map(({ teams, label }) => {
		const acc = new Map<string, EquipoStanding>();
		for (const t of teams) {
			acc.set(t, { equipo: t, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0, pos: 0, enVivo: false, terceroClasifica: false });
		}

		let jugados = 0;
		const gms: GM[] = []; // partidos jugados de este grupo (para el head-to-head)
		for (const p of partidos) {
			if (!acc.has(p.equipoA) || !acc.has(p.equipoB)) continue; // no es de este grupo
			if (p.golesA === null || p.golesB === null) continue; // aún sin marcador
			jugados++;
			gms.push({ a: p.equipoA, b: p.equipoB, ga: p.golesA, gb: p.golesB });
			const A = acc.get(p.equipoA)!;
			const B = acc.get(p.equipoB)!;
			A.pj++;
			B.pj++;
			A.gf += p.golesA;
			A.gc += p.golesB;
			B.gf += p.golesB;
			B.gc += p.golesA;
			if (p.golesA > p.golesB) {
				A.g++;
				A.pts += 3;
				B.p++;
			} else if (p.golesA < p.golesB) {
				B.g++;
				B.pts += 3;
				A.p++;
			} else {
				A.e++;
				B.e++;
				A.pts++;
				B.pts++;
			}
			if (p.enCurso) {
				A.enVivo = true;
				B.enVivo = true;
			}
		}

		for (const s of acc.values()) s.dg = s.gf - s.gc;

		// Orden oficial FIFA 2026 (incluye head-to-head entre empatados en puntos).
		const equipos = ordenarGrupoFIFA([...acc.values()], gms);
		equipos.forEach((s, i) => (s.pos = i + 1));

		return { label, equipos, partidosJugados: jugados };
	});

	// Mejores 8 terceros (regla del Mundial 2026): se rankean los 12 terceros entre sí por los
	// mismos criterios (pts, dif. de goles, goles a favor) y los 8 primeros clasifican.
	const terceros = grupos.map((g) => g.equipos[2]).filter((t): t is EquipoStanding => !!t);
	terceros.sort(
		(x, y) => y.pts - x.pts || y.dg - x.dg || y.gf - x.gf || x.equipo.localeCompare(y.equipo, 'es')
	);
	terceros.slice(0, 8).forEach((t) => (t.terceroClasifica = true));

	return grupos;
}
