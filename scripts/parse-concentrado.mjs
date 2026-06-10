// Parser determinista del Concentrado de la quiniela.
// Lee table.txt (generado con `pdftotext -enc UTF-8 -table`) y produce
// scripts/quiniela-data.json: participantes[] + partidos[{numero,equipoA,
// equipoB,pronosticos[]}], donde pronosticos[i] = [golesA,golesB] del
// participante i. El número de participantes se detecta del header (dinámico).
import fs from 'node:fs';

const raw = fs.readFileSync('table.txt', 'utf8');
const lines = raw.split(/\r?\n/);

// Header: primera línea no vacía. Split en 2+ espacios → ["Equipo 1","Equipo 2",...nombres].
const headerLine = lines.find((l) => /Equipo\s*1/.test(l));
const headerCols = headerLine.trim().split(/\s{2,}/);
const participantes = headerCols.slice(2); // quita "Equipo 1" y "Equipo 2"
const N = participantes.length;

const partidos = [];
for (const l of lines) {
	if (!/^\s*\d+\s/.test(l)) continue; // solo filas de datos
	const scores = l.match(/\d+-\d+/g) || [];
	if (scores.length !== N) {
		throw new Error(`Fila con ${scores.length} marcadores (esperaba ${N}): ${l}`);
	}
	// Texto antes del primer marcador = "<num>  EquipoA   EquipoB"
	const firstScoreIdx = l.search(/\d+-\d+/);
	const pre = l.slice(0, firstScoreIdx).trim();
	const numero = parseInt(pre.split(/\s+/)[0], 10);
	const teamsPart = pre.replace(/^\d+\s+/, '');
	const teams = teamsPart.split(/\s{2,}/);
	if (teams.length !== 2) {
		throw new Error(`Fila ${numero}: esperaba 2 equipos, obtuve ${JSON.stringify(teams)}`);
	}
	const pronosticos = scores.map((s) => s.split('-').map((n) => parseInt(n, 10)));
	partidos.push({ numero, equipoA: teams[0], equipoB: teams[1], pronosticos });
}

// --- Verificación ---
const problems = [];
if (partidos.length !== 72) problems.push(`partidos=${partidos.length} (esperaba 72)`);
const nums = partidos.map((p) => p.numero);
for (let i = 1; i <= 72; i++) if (!nums.includes(i)) problems.push(`falta partido ${i}`);
for (const p of partidos) {
	if (p.pronosticos.length !== N) problems.push(`partido ${p.numero}: ${p.pronosticos.length} pronósticos`);
	for (const [a, b] of p.pronosticos)
		if (!Number.isInteger(a) || !Number.isInteger(b)) problems.push(`partido ${p.numero}: marcador inválido`);
}

console.log('participantes (' + N + '):', participantes.join(', '));
console.log('partidos:', partidos.length, '| pronósticos totales:', partidos.length * N);
console.log('problemas:', problems.length ? problems.join(' | ') : 'NINGUNO ✓');

const idxLast = N - 1;
console.log('\n=== SPOT-CHECKS (cotejar vs PDF) ===');
for (const n of [1, 11, 19, 36, 37, 72]) {
	const p = partidos.find((x) => x.numero === n);
	const f = (i) => p.pronosticos[i].join('-');
	console.log(
		`#${n} ${p.equipoA} vs ${p.equipoB} | ${participantes[0]}=${f(0)} ${participantes[1]}=${f(1)} ${participantes[idxLast]}(últ)=${f(idxLast)}`
	);
}

fs.writeFileSync('scripts/quiniela-data.json', JSON.stringify({ participantes, partidos }, null, '\t'));
console.log('\n→ escrito scripts/quiniela-data.json');
