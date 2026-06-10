import { fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const rows = await db.select().from(partidos).orderBy(asc(partidos.numero));

	// Orden de presentación: los ya jugados primero (más reciente arriba) y los
	// pendientes después en orden de partido (1→72) para capturarlos en secuencia.
	rows.sort((a, b) => {
		const aJugado = a.fecha ? 1 : 0;
		const bJugado = b.fecha ? 1 : 0;
		if (aJugado !== bJugado) return bJugado - aJugado;
		if (aJugado === 1) return (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0);
		return a.numero - b.numero;
	});

	return { partidos: rows, isAdmin: locals.isAdmin };
};

export const actions: Actions = {
	// Capturar/editar el marcador REAL de un partido — SOLO admin.
	setResult: async ({ request, locals }) => {
		const data = await request.formData();
		const partidoId = Number(data.get('partidoId'));
		const golesARaw = String(data.get('golesA') ?? '').trim();
		const golesBRaw = String(data.get('golesB') ?? '').trim();

		if (!locals.isAdmin) {
			return fail(403, { error: 'Solo el admin puede registrar resultados.', partidoId });
		}
		if (!Number.isInteger(partidoId)) {
			return fail(400, { error: 'Partido inválido.', partidoId });
		}

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
			return fail(400, { error: 'Marcador inválido (enteros ≥ 0).', partidoId });
		}

		await db
			.update(partidos)
			.set({ golesA, golesB, fecha: new Date() })
			.where(eq(partidos.id, partidoId));
		return { ok: true };
	},

	// Limpiar el marcador (volver a pendiente) — SOLO admin.
	clearResult: async ({ request, locals }) => {
		const data = await request.formData();
		const partidoId = Number(data.get('partidoId'));

		if (!locals.isAdmin) {
			return fail(403, { error: 'Solo el admin.', partidoId });
		}
		if (!Number.isInteger(partidoId)) {
			return fail(400, { error: 'Partido inválido.', partidoId });
		}

		await db
			.update(partidos)
			.set({ golesA: null, golesB: null, fecha: null })
			.where(eq(partidos.id, partidoId));
		return { ok: true };
	}
};
