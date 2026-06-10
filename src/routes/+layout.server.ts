import type { LayoutServerLoad } from './$types';

// Expone isAdmin a TODAS las rutas (vía data del layout) para que el top navbar
// muestre el indicador de sesión en cualquier página.
export const load: LayoutServerLoad = async ({ locals, setHeaders }) => {
	// El HTML de cada página depende de la SESIÓN (isAdmin) y de datos que cambian
	// en vivo (resultados, posiciones, cuadrícula iluminándose). Sin Cache-Control,
	// SvelteKit emite un ETag y el navegador cachea heurísticamente la página: al
	// recargar te sirve su copia guardada —p. ej. la versión SIN admin, hecha antes
	// de iniciar sesión— en lugar de pedir una fresca al server (que sí leería tu
	// cookie). Por eso parecía que "perdías" la sesión al recargar y solo borrar
	// caché lo arreglaba. `no-store` impide ese cacheo del HTML (y de paso desactiva
	// el bfcache en Chrome). No afecta a los assets inmutables, que se sirven aparte.
	setHeaders({ 'cache-control': 'no-store' });
	return { isAdmin: locals.isAdmin };
};
