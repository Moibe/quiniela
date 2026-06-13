import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import { computeGrupos } from '$lib/grupos';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	// Atar el load a la navegación (ver nota en la home): datos frescos al llegar.
	void url.pathname;

	const mats = await db.select().from(partidos);
	const grupos = computeGrupos(mats);
	const jugados = mats.filter((m) => m.golesA !== null && m.golesB !== null).length;

	return { grupos, jugados, total: mats.length };
};
