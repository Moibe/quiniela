import { db } from '$lib/server/db';
import { participantes, partidos, pronosticos } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';
import { computeBracket } from '$lib/bracket';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const [parts, mats, pros] = await Promise.all([
		db.select().from(participantes).orderBy(asc(participantes.posicion), asc(participantes.id)),
		db.select().from(partidos).orderBy(asc(partidos.numero)),
		db.select().from(pronosticos)
	]);

	// Participante seleccionado: ?p=<id> (validado); por defecto, Moi.
	const moi = parts.find((p) => p.nombre === 'Moi');
	const pParam = Number(url.searchParams.get('p'));
	const selected = parts.find((p) => p.id === pParam) ?? moi ?? parts[0];

	const cruces = selected ? computeBracket(mats, pros, selected.id) : [];

	return {
		participantes: parts.map((p) => ({ id: p.id, nombre: p.nombre })),
		selectedId: selected?.id ?? null,
		selectedNombre: selected?.nombre ?? '',
		cruces
	};
};
