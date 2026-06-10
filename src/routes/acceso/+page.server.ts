import { fail, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ADMIN_COOKIE, adminCookieToken } from '../../hooks.server';
import type { Actions, PageServerLoad } from './$types';

// Solo permite redirigir a rutas internas (evita open-redirect).
function destino(target: string | null): string {
	return target && target.startsWith('/') && !target.startsWith('//') ? target : '/';
}

export const load: PageServerLoad = async ({ locals, url }) => {
	// Si ya es admin, no tiene caso mostrar el login.
	if (locals.isAdmin) redirect(303, destino(url.searchParams.get('redirectTo')));
	return { redirectTo: destino(url.searchParams.get('redirectTo')) };
};

export const actions: Actions = {
	login: async ({ request, cookies, url }) => {
		const redirectTo = destino(url.searchParams.get('redirectTo'));
		const pw = env.ADMIN_PASSWORD ?? '';
		if (!pw) {
			return fail(500, { error: 'ADMIN_PASSWORD no está configurado en el servidor.' });
		}

		const data = await request.formData();
		const password = String(data.get('password') ?? '');

		// Comparación en tiempo constante sobre hashes de igual longitud.
		const a = createHash('sha256').update(password).digest();
		const b = createHash('sha256').update(pw).digest();
		if (!timingSafeEqual(a, b)) {
			return fail(401, { error: 'Contraseña incorrecta.' });
		}

		const token = adminCookieToken();
		if (!token) {
			return fail(500, { error: 'No se pudo generar la sesión.' });
		}

		cookies.set(ADMIN_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: !dev,
			maxAge: 60 * 60 * 24 * 30 // 30 días
		});

		redirect(303, redirectTo);
	},

	logout: async ({ cookies, url }) => {
		cookies.delete(ADMIN_COOKIE, { path: '/' });
		redirect(303, destino(url.searchParams.get('redirectTo')));
	}
};
