import { redirect, type Handle } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { env } from '$env/dynamic/private';

export const ADMIN_COOKIE = 'admin';

// Host del subdominio de administración. Al entrar directo a su raíz, mandamos
// al admin a Partidos (la pantalla de captura), que es lo que va a usar.
const ADMIN_HOST = 'administracion.noxoroxo.com';

// Token de cookie derivado de la contraseña: sha256("quiniela-admin:" + pw).
// Es estable mientras la contraseña no cambie, no revela la contraseña (no se
// puede invertir) y no se puede falsificar sin conocerla. Si ADMIN_PASSWORD no
// está configurado, no hay admin posible (devuelve null).
export function adminCookieToken(): string | null {
	const pw = env.ADMIN_PASSWORD ?? '';
	if (!pw) return null;
	return createHash('sha256').update(`quiniela-admin:${pw}`).digest('hex');
}

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(ADMIN_COOKIE);
	const expected = adminCookieToken();
	event.locals.isAdmin = expected !== null && token === expected;

	// En el subdominio admin, la ENTRADA DIRECTA (carga completa: URL directa,
	// marcador o refresh) a la raíz va a Partidos. La navegación interna del menú
	// (isDataRequest, sin recargar) NO se redirige → "Participantes" sigue
	// accesible desde la barra. El apex noxoroxo.com no se toca.
	if (
		!event.isDataRequest &&
		event.url.pathname === '/' &&
		event.url.hostname === ADMIN_HOST
	) {
		redirect(307, '/partidos');
	}

	return resolve(event);
};
