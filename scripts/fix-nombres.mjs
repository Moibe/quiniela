// Corrección de acentos en nombres de participante: 'Moises' → 'Moisés' y
// 'Ruben' → 'Rubén'. Solo cambia el texto del nombre; NO toca los IDs, así que
// no afecta pronósticos ni nada relacionado. IDEMPOTENTE: solo actualiza si el
// nombre viejo todavía existe, así correrlo más de una vez no hace daño.
//
// Uso (local o en el Droplet): npm run db:fix-nombres
import Database from 'better-sqlite3';

const dbUrl = process.env.DATABASE_URL ?? './local.db';
const db = new Database(dbUrl);

const CAMBIOS = [
	{ de: 'Moises', a: 'Moisés' },
	{ de: 'Ruben', a: 'Rubén' }
];

const upd = db.prepare('UPDATE participantes SET nombre = ? WHERE nombre = ?');
let cambios = 0;
for (const c of CAMBIOS) {
	const res = upd.run(c.a, c.de);
	if (res.changes > 0) {
		cambios += res.changes;
		console.log(`${c.de} → ${c.a}  ✓`);
	} else {
		console.log(`"${c.de}" no está (¿ya corregido?)`);
	}
}

console.log(`\nListo. ${cambios} nombre(s) corregido(s).`);
db.close();
