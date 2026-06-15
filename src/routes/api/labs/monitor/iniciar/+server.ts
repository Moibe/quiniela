// POST /api/labs/monitor/iniciar — experimental (Labs, solo admin): empieza a
// monitorear UNA url de Cloudbet con el paquete. No persiste a disco. Pensado para
// correr con quiniela en LOCAL (región OK); en el droplet daría 403 (geo-block).
import { error, json } from '@sveltejs/kit';
import { monitorMarcadores, carpetaDesdeUrl } from '@moibe/partido-nucleo';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.isAdmin) error(403, 'Solo admin.');

	// Puente: el paquete lee process.env; SvelteKit expone el .env vía $env. Así el
	// modo lanzar headless (PARTIDO_NAVEGADOR_MODO=lanzar + PARTIDO_CHROME_PATH) se
	// configura desde el .env de quiniela sin depender del shell.
	for (const k of ['PARTIDO_NAVEGADOR_MODO', 'PARTIDO_CHROME_PATH']) {
		if (env[k] && !process.env[k]) process.env[k] = env[k];
	}

	const cuerpo = await request.json().catch(() => ({}));
	const url = typeof cuerpo.url === 'string' ? cuerpo.url.trim() : '';
	let parseada: URL;
	try {
		parseada = new URL(url);
		if (!['http:', 'https:'].includes(parseada.protocol)) throw new Error();
	} catch {
		error(400, 'URL inválida (http/https).');
	}

	try {
		const est = await monitorMarcadores.agregar(url, {
			carpeta: `labs-${carpetaDesdeUrl(parseada)}`,
			persistir: false
		});
		return json(est);
	} catch (e) {
		error(409, e instanceof Error ? e.message : 'No pude iniciar el monitoreo.');
	}
};
