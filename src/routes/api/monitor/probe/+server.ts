// GET/POST /api/monitor/probe — el "Probador" de Labs (admin). GET: estado del sandbox (URL +
// último marcador leído) para el display. POST { url }: fija/limpia la URL a probar. NO toca
// `partidos` — es un sandbox en memoria (ver $lib/server/probe). El lector local lee/empuja
// por /api/monitor/probe/feed (con secret).
import { error, json } from '@sveltejs/kit';
import { getProbe, setProbeUrl } from '$lib/server/probe';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.isAdmin) error(403, 'Solo administración.');
	return json(getProbe());
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.isAdmin) error(403, 'Solo administración.');

	const body = await request.json().catch(() => ({}));
	const raw = typeof body.url === 'string' ? body.url.trim() : '';
	if (!raw) {
		setProbeUrl(null);
		return json({ ok: true, url: null });
	}

	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		error(400, 'URL inválida.');
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		error(400, 'La URL debe ser http(s).');
	}

	setProbeUrl(raw);
	return json({ ok: true, url: raw });
};
