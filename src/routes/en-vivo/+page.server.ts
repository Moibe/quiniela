// Página pública "En Vivo": marcadores de los partidos que se juegan ahora mismo.
// Fuente encadenada monitor→manual (ver $lib/server/enVivo). Atada a la navegación para llegar con
// datos frescos; el front además pollea /api/en-vivo.
import { partidosEnVivo } from '$lib/server/enVivo';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	void url.pathname; // datos frescos al navegar a la página
	return partidosEnVivo(Date.now());
};
