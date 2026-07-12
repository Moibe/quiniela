// Resultados EN VIVO de los juegos de Q2 (del sandbox del monitor), para colorear los aciertos de la
// tabla. Atado a la navegación para llegar con datos frescos; el front además pollea /api/q2.
import { q2EnVivo } from '$lib/server/enVivo';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	void url.pathname;
	return { resultados: q2EnVivo(Date.now()) };
};
