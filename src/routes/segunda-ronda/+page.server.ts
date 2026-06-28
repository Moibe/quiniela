import { db } from '$lib/server/db';
import { participantes, partidos, pronosticos } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';
import { computeBracket, computeBracketReal } from '$lib/bracket';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	// Atar el load a la navegación: datos frescos al llegar (la opción "Real"
	// cambia con cada resultado que captura el admin).
	void url.pathname;

	const [parts, mats, pros] = await Promise.all([
		db.select().from(participantes).orderBy(asc(participantes.posicion), asc(participantes.id)),
		db.select().from(partidos).orderBy(asc(partidos.numero)),
		db.select().from(pronosticos)
	]);

	const jugados = mats.filter((m) => m.golesA !== null && m.golesB !== null).length;

	// Selección por ?p=: "real" (resultados hasta ahora) o el id de un participante.
	// Por defecto (sin parámetro o inválido) se muestra el cuadro REAL.
	const pParam = url.searchParams.get('p');
	const participante =
		pParam && pParam !== 'real' ? (parts.find((p) => p.id === Number(pParam)) ?? null) : null;

	// Cuadro REAL (hasta ahora). En la vista de un participante, además comparamos su cuadro contra el
	// real para marcar los cruces ACERTADOS (mismo enfrentamiento exacto en esa llave).
	const reales = computeBracketReal(mats);
	const cruces = participante
		? (() => {
				const realPorNum = new Map(reales.map((c) => [c.numero, c]));
				return computeBracket(mats, pros, participante.id).map((c) => {
					const r = realPorNum.get(c.numero);
					const acierto = !!r && r.a.equipo === c.a.equipo && r.b.equipo === c.b.equipo;
					return { ...c, acierto };
				});
			})()
		: reales.map((c) => ({ ...c, acierto: false }));

	return {
		participantes: parts.map((p) => ({ id: p.id, nombre: p.nombre })),
		selectedKey: participante ? String(participante.id) : 'real',
		selectedNombre: participante?.nombre ?? null,
		esReal: !participante,
		jugados,
		totalPartidos: mats.length,
		cruces
	};
};
