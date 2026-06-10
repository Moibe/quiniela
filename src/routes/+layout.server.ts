import type { LayoutServerLoad } from './$types';

// Expone isAdmin a TODAS las rutas (vía data del layout) para que el top navbar
// muestre el indicador de sesión en cualquier página.
export const load: LayoutServerLoad = async ({ locals }) => {
	return { isAdmin: locals.isAdmin };
};
