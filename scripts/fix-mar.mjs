// Corrección puntual de los pronósticos de Mar.
//
// El PDF de origen (concentrado_quiniela_final.pdf) traía por error "9-1" y "9-2"
// en los partidos #8 (Catar-Suiza) y #9 (C. de Marfil-Ecuador) de la columna Mar;
// debían ser "0-1" y "0-2". El pipeline (pdftotext→parse→seed) los copió fiel.
//
// Esto actualiza SOLO esas 2 celdas en la tabla `pronosticos`, sin re-sembrar:
// no toca resultados reales ni ningún otro dato. Es IDEMPOTENTE — solo cambia la
// celda si su goles_a es 9, así que correrlo más de una vez no hace daño.
//
// Uso (local o en el Droplet): npm run db:fix-mar
import Database from 'better-sqlite3';

const dbUrl = process.env.DATABASE_URL ?? './local.db';
const db = new Database(dbUrl);

const mar = db.prepare("SELECT id FROM participantes WHERE nombre = 'Mar'").get();
if (!mar) {
	console.error("✗ No se encontró el participante 'Mar'. Aborta.");
	process.exit(1);
}

const objetivos = [
	{ numero: 8, desc: 'Catar vs Suiza' },
	{ numero: 9, desc: 'C. de Marfil vs Ecuador' }
];

let cambios = 0;
for (const o of objetivos) {
	const partido = db.prepare('SELECT id FROM partidos WHERE numero = ?').get(o.numero);
	if (!partido) {
		console.error(`✗ No existe el partido #${o.numero}.`);
		continue;
	}
	const prono = db
		.prepare(
			'SELECT id, goles_a, goles_b FROM pronosticos WHERE partido_id = ? AND participante_id = ?'
		)
		.get(partido.id, mar.id);
	if (!prono) {
		console.error(`✗ Mar no tiene pronóstico en #${o.numero}.`);
		continue;
	}
	const antes = `${prono.goles_a}-${prono.goles_b}`;
	if (prono.goles_a === 9) {
		db.prepare('UPDATE pronosticos SET goles_a = 0 WHERE id = ?').run(prono.id);
		cambios++;
		console.log(`#${o.numero} (${o.desc}) Mar: ${antes} → 0-${prono.goles_b}  ✓ corregido`);
	} else {
		console.log(`#${o.numero} (${o.desc}) Mar: ${antes}  (sin "9", no se toca)`);
	}
}

console.log(`\nListo. ${cambios} celda(s) corregida(s).`);
db.close();
