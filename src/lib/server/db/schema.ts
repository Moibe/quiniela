import { sqliteTable, integer, text, unique } from 'drizzle-orm/sqlite-core';

// Los ~30 jugadores de la quiniela (columnas del Concentrado).
export const participantes = sqliteTable('participantes', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	nombre: text('nombre').notNull(),
	// Orden de columna en el Concentrado original, para mostrarlos igual.
	posicion: integer('posicion').notNull().default(0),
	// Posición en la tabla JUSTO ANTES del último marcador registrado. Se usa
	// para las flechitas de "subió/bajó" en Lugares. null = sin movimiento aún.
	rankAnterior: integer('rank_anterior')
});

// Los 72 partidos de la fase de grupos (filas del Concentrado). El resultado
// REAL (golesA/golesB) es null hasta que se juega; lo captura el admin.
export const partidos = sqliteTable('partidos', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	numero: integer('numero').notNull().unique(), // 1..72
	equipoA: text('equipo_a').notNull(),
	equipoB: text('equipo_b').notNull(),
	golesA: integer('goles_a'),
	golesB: integer('goles_b'),
	// Cuándo se registró/jugó el resultado real (null mientras esté pendiente).
	fecha: integer('fecha', { mode: 'timestamp' }),
	// true = marcador PROVISIONAL capturado en vivo (muestra "Partido en Curso");
	// false = resultado final. En ambos casos el marcador cuenta para los puntos.
	enCurso: integer('en_curso', { mode: 'boolean' }).notNull().default(false),
	// URL del partido en Cloudbet, para que el monitor externo (Plan A) lea su marcador.
	urlCloudbet: text('url_cloudbet'),
	// true = el admin encendió la vigilancia de este partido; el monitor externo lo toma.
	monitorear: integer('monitorear', { mode: 'boolean' }).notNull().default(false),
	// true = el marcador actual lo escribió En Vivo automáticamente desde el monitor (no un humano).
	// Mientras sea true, En Vivo puede irlo actualizando; si un humano lo edita, pasa a false y En
	// Vivo deja de tocarlo (nunca pisa lo capturado a mano).
	autoMonitor: integer('auto_monitor', { mode: 'boolean' }).notNull().default(false),
	// Hora de inicio programada, leída por el monitor del listado de Cloudbet. Cloudbet sólo da texto
	// relativo ("Today • 2:00 PM"), así que el runner lo resuelve a un instante absoluto al leerlo (con
	// el reloj de SU máquina, que se asume en hora de México). null mientras nadie la haya capturado.
	inicioCloudbet: integer('inicio_cloudbet', { mode: 'timestamp' })
});

// La matriz de pronósticos: 72 partidos × 29 participantes. golesA/golesB son
// el marcador que ese participante predijo para ese partido.
export const pronosticos = sqliteTable(
	'pronosticos',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		partidoId: integer('partido_id')
			.notNull()
			.references(() => partidos.id),
		participanteId: integer('participante_id')
			.notNull()
			.references(() => participantes.id),
		golesA: integer('goles_a').notNull(),
		golesB: integer('goles_b').notNull()
	},
	(t) => [unique('pronostico_unico').on(t.partidoId, t.participanteId)]
);

// Resultados de los 5 juegos de la Quiniela 2 (bracket J1-J5). Van APARTE de `partidos` a propósito:
// Q2 comparte nombres de equipos con el torneo y trae placeholders (G J1, P J2…) que romperían la
// derivación de grupos/bracket si entraran a `partidos`. Los captura el admin en /q2. La clave es la
// etiqueta del juego ('J1'..'J5'); golesA/golesB null = sin resultado; enCurso = marcador en vivo.
export const q2Resultados = sqliteTable('q2_resultados', {
	etiqueta: text('etiqueta').primaryKey(), // 'J1'..'J5'
	golesA: integer('goles_a'),
	golesB: integer('goles_b'),
	enCurso: integer('en_curso', { mode: 'boolean' }).notNull().default(false),
	fecha: integer('fecha', { mode: 'timestamp' })
});

export type Participante = typeof participantes.$inferSelect;
export type Partido = typeof partidos.$inferSelect;
export type Pronostico = typeof pronosticos.$inferSelect;
export type Q2Resultado = typeof q2Resultados.$inferSelect;
