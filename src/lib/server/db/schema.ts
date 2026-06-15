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
	monitorear: integer('monitorear', { mode: 'boolean' }).notNull().default(false)
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

export type Participante = typeof participantes.$inferSelect;
export type Partido = typeof partidos.$inferSelect;
export type Pronostico = typeof pronosticos.$inferSelect;
