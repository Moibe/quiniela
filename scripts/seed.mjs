// Seed de la quiniela: lee scripts/quiniela-data.json (extraído del PDF
// Concentrado) y puebla participantes, partidos y pronosticos. Idempotente:
// limpia y reinserta, así se puede re-correr sin duplicar.
import fs from 'node:fs';
import Database from 'better-sqlite3';

const url = process.env.DATABASE_URL ?? './local.db';
const data = JSON.parse(fs.readFileSync('scripts/quiniela-data.json', 'utf8'));

// Normalización de nombres de equipo: el PDF original escribe 3 equipos de
// forma inconsistente. Unificamos a la abreviatura con punto (estilo del resto
// de la hoja: "E. Unidos", "R. Checa", "C. de Marfil"). El JSON queda fiel al
// PDF; la DB queda consistente.
const NORMALIZA = {
	'N, Zelanda': 'N. Zelanda',
	'N Zelanda': 'N. Zelanda',
	'Países Bajos': 'P. Bajos',
	'Cabo Verde': 'C. Verde'
};
const norm = (nombre) => NORMALIZA[nombre] ?? nombre;

// Correcciones de marcadores mal capturados en el PDF de origen. Mar traía
// "9-1"/"9-2" en #8/#9 (goles imposibles; debían ser 0-1/0-2). El JSON queda
// fiel al PDF; aquí se corrige al sembrar (igual que NORMALIZA con los nombres).
const CORRECCIONES = [
	{ participante: 'Mar', partido: 8, golesA: 0, golesB: 1 },
	{ participante: 'Mar', partido: 9, golesA: 0, golesB: 2 }
];
for (const c of CORRECCIONES) {
	const pi = data.participantes.indexOf(c.participante);
	const partido = data.partidos.find((p) => p.numero === c.partido);
	if (pi >= 0 && partido) partido.pronosticos[pi] = [c.golesA, c.golesB];
}

const db = new Database(url);
db.pragma('foreign_keys = ON');

const insertParticipante = db.prepare('INSERT INTO participantes (nombre, posicion) VALUES (?, ?)');
const insertPartido = db.prepare('INSERT INTO partidos (numero, equipo_a, equipo_b) VALUES (?, ?, ?)');
const insertPronostico = db.prepare(
	'INSERT INTO pronosticos (partido_id, participante_id, goles_a, goles_b) VALUES (?, ?, ?, ?)'
);

const seed = db.transaction(() => {
	// Limpia en orden de FKs (hijos primero) y reinicia los autoincrement.
	db.prepare('DELETE FROM pronosticos').run();
	db.prepare('DELETE FROM partidos').run();
	db.prepare('DELETE FROM participantes').run();
	db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('pronosticos','partidos','participantes')").run();

	const participanteIds = data.participantes.map(
		(nombre, i) => insertParticipante.run(nombre, i).lastInsertRowid
	);

	for (const p of data.partidos) {
		const partidoId = insertPartido.run(p.numero, norm(p.equipoA), norm(p.equipoB)).lastInsertRowid;
		p.pronosticos.forEach(([golesA, golesB], i) => {
			insertPronostico.run(partidoId, participanteIds[i], golesA, golesB);
		});
	}
});

seed();

const count = (t) => db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
console.log(
	`Seed OK → participantes: ${count('participantes')} | partidos: ${count('partidos')} | pronosticos: ${count('pronosticos')}`
);
db.close();
