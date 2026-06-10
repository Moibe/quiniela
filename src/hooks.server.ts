import type { Handle } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { env } from '$env/dynamic/private';

export const ADMIN_COOKIE = 'admin';

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
	return resolve(event);
};
