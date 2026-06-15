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
	pts: number; // puntos
	pos: number; // posición en el grupo (1..4)
	enVivo: boolean; // está jugando ahora (partido en curso)
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
	return etiquetados.map(({ teams, label }) => {
		const acc = new Map<string, EquipoStanding>();
		for (const t of teams) {
			acc.set(t, { equipo: t, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0, pos: 0, enVivo: false });
		}

		let jugados = 0;
		for (const p of partidos) {
			if (!acc.has(p.equipoA) || !acc.has(p.equipoB)) continue; // no es de este grupo
			if (p.golesA === null || p.golesB === null) continue; // aún sin marcador
			jugados++;
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

		const equipos = [...acc.values()].sort(
			(x, y) =>
				y.pts - x.pts || y.dg - x.dg || y.gf - x.gf || x.equipo.localeCompare(y.equipo, 'es')
		);
		equipos.forEach((s, i) => (s.pos = i + 1));

		return { label, equipos, partidosJugados: jugados };
	});
}
