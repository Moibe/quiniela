// Resultados EN VIVO/finales de los juegos de Q2 (persistidos por el admin + overlay del sandbox del
// monitor), para colorear los aciertos de la tabla. El front además pollea /api/q2.
// Captura de resultados de Q2 (SOLO admin): se guarda en la tabla `q2_resultados`, APARTE de `partidos`
// (Q2 comparte equipos/placeholders con el torneo y no debe tocar grupos/bracket).
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { q2Resultados } from '$lib/server/db/schema';
import { q2Efectivo } from '$lib/server/enVivo';
import { q2Juegos } from '$lib/q2Data';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

const etiquetasValidas = new Set(q2Juegos.map((j) => j.etiqueta));

export const load: PageServerLoad = async ({ locals, url }) => {
	void url.pathname;
	return { resultados: await q2Efectivo(Date.now()), isAdmin: locals.isAdmin };
};

// Captura/edita el marcador de un juego de Q2 — SOLO admin.
//  • enCurso=false → resultado FINAL.  • enCurso=true → marcador EN VIVO (pulsa en la tabla).
async function guardarQ2({ request, locals }: RequestEvent, enCurso: boolean) {
	const data = await request.formData();
	const etiqueta = String(data.get('etiqueta') ?? '');
	const golesARaw = String(data.get('golesA') ?? '').trim();
	const golesBRaw = String(data.get('golesB') ?? '').trim();

	if (!locals.isAdmin) return fail(403, { error: 'Solo el admin puede registrar resultados.', etiqueta });
	if (!etiquetasValidas.has(etiqueta)) return fail(400, { error: 'Juego inválido.', etiqueta });

	const golesA = Number(golesARaw);
	const golesB = Number(golesBRaw);
	if (
		golesARaw === '' ||
		golesBRaw === '' ||
		!Number.isInteger(golesA) ||
		golesA < 0 ||
		!Number.isInteger(golesB) ||
		golesB < 0
	) {
		return fail(400, { error: 'Marcador inválido (enteros ≥ 0).', etiqueta });
	}

	await db
		.insert(q2Resultados)
		.values({ etiqueta, golesA, golesB, enCurso, fecha: new Date() })
		.onConflictDoUpdate({
			target: q2Resultados.etiqueta,
			set: { golesA, golesB, enCurso, fecha: new Date() }
		});
	return { ok: true };
}

export const actions: Actions = {
	setResult: (event) => guardarQ2(event, false),
	setPartial: (event) => guardarQ2(event, true),
	clearResult: async ({ request, locals }) => {
		const data = await request.formData();
		const etiqueta = String(data.get('etiqueta') ?? '');
		if (!locals.isAdmin) return fail(403, { error: 'Solo el admin.', etiqueta });
		if (!etiquetasValidas.has(etiqueta)) return fail(400, { error: 'Juego inválido.', etiqueta });
		await db.delete(q2Resultados).where(eq(q2Resultados.etiqueta, etiqueta));
		return { ok: true };
	}
};
