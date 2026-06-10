import { fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Orden FIJO por número de partido (#1→#72): nada se reordena al capturar
	// resultados; cada partido solo se "enciende" en su lugar. Así coincide fila
	// por fila con la cuadrícula de Participantes y no hay brincos confusos.
	const rows = await db.select().from(partidos).orderBy(asc(partidos.numero));

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
