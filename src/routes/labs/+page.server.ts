import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Labs es SOLO para administración: sin sesión de admin la página "no existe"
// (mismo criterio con el que se oculta el resto del área de admin). Esto protege
// la ruta aunque alguien la teclee directo, no solo escondiendo el menú.
export const load: PageServerLoad = ({ locals }) => {
	if (!locals.isAdmin) error(404, 'Página no existe');
	return {};
};
