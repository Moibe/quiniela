// Arma el cuadro de cruces de la fase final (Round of 32) SEGÚN los pronósticos
// de un participante. No hay pronósticos de eliminatoria en la base: usamos los
// 72 marcadores que predijo esa persona como si fueran los resultados de grupos,
// calculamos las tablas, sacamos los 32 clasificados y los sembramos en 16 llaves.
import { computeGrupos, type EquipoStanding } from './grupos';

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
	tercero: boolean; // clasificó como mejor tercero
};

export type Cruce = {
	llave: number;
	a: Clasificado;
	b: Clasificado;
};

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

	const grupos = computeGrupos(virtual);

	const primeros: Clasificado[] = [];
	const segundos: Clasificado[] = [];
	const terceros: (Clasificado & { _st: EquipoStanding })[] = [];

	for (const g of grupos) {
		const [p1, p2, p3] = g.equipos;
		if (p1) primeros.push(toClas(p1, `1° ${g.label}`, g.label, false));
		if (p2) segundos.push(toClas(p2, `2° ${g.label}`, g.label, false));
		if (p3) terceros.push({ ...toClas(p3, `3° ${g.label}`, g.label, true), _st: p3 });
	}

	// Mejores 8 terceros (de 12) por desempeño.
	const mejoresTerceros = terceros
		.sort((a, b) => rank(a._st, b._st))
		.slice(0, 8)
		.map(({ _st, ...c }) => c);

	// Siembra: 1os (por desempeño), luego 2os, luego mejores 3os.
	const byRank = (a: Clasificado, b: Clasificado) =>
		b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.equipo.localeCompare(b.equipo, 'es');
	const seeded = [
		...primeros.sort(byRank),
		...segundos.sort(byRank),
		...mejoresTerceros.sort(byRank)
	];

	// Cruces: mejor sembrado vs peor sembrado (1-32, 2-31…), PERO sin enfrentar a
	// dos equipos del mismo grupo (ya jugaron entre sí en la fase de grupos). Se
	// resuelve con backtracking: para cada mejor sembrado disponible se prueba al
	// peor rival válido (de otro grupo) y se retrocede si se llega a un callejón.
	const n = seeded.length;
	const usado = new Array<boolean>(n).fill(false);
	const pares: [number, number][] = [];

	const emparejar = (): boolean => {
		let a = -1;
		for (let i = 0; i < n; i++) {
			if (!usado[i]) {
				a = i;
				break;
			}
		}
		if (a === -1) return true; // todos emparejados

		usado[a] = true;
		for (let b = n - 1; b > a; b--) {
			if (usado[b]) continue;
			if (seeded[b].grupo === seeded[a].grupo) continue; // mismo grupo: prohibido
			usado[b] = true;
			pares.push([a, b]);
			if (emparejar()) return true;
			pares.pop();
			usado[b] = false;
		}
		usado[a] = false;
		return false;
	};

	if (emparejar()) {
		return pares.map(([a, b], i) => ({ llave: i + 1, a: seeded[a], b: seeded[b] }));
	}

	// Fallback defensivo (no debería ocurrir con 12 grupos / máx 3 por grupo).
	const cruces: Cruce[] = [];
	for (let i = 0; i < Math.floor(n / 2); i++) {
		cruces.push({ llave: i + 1, a: seeded[i], b: seeded[n - 1 - i] });
	}
	return cruces;
}

function toClas(s: EquipoStanding, origen: string, grupo: string, tercero: boolean): Clasificado {
	return { equipo: s.equipo, origen, grupo, pts: s.pts, dg: s.dg, gf: s.gf, tercero };
}
