// Página pública "En Vivo": los partidos marcados EN CURSO con su marcador oficial (de `partidos`).
// Atada a la navegación para llegar con datos frescos; el front además pollea /api/en-vivo.
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	void url.pathname; // datos frescos al navegar a la página

	const enCurso = await db
		.select({
			numero: partidos.numero,
			equipoA: partidos.equipoA,
			equipoB: partidos.equipoB,
			golesA: partidos.golesA,
			golesB: partidos.golesB
		})
		.from(partidos)
		.where(eq(partidos.enCurso, true))
		.orderBy(asc(partidos.numero));

	return { enCurso };
};
