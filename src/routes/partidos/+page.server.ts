import { fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { partidos } from '$lib/server/db/schema';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Atar el load a la navegación (ver nota en la home): re-ejecuta al llegar,
	// para ver marcadores frescos sin recargar.
	void url.pathname;

	// Orden FIJO por número de partido (#1→#72): nada se reordena al capturar
	// resultados; cada partido solo se "enciende" en su lugar. Así coincide fila
	// por fila con la cuadrícula de Participantes y no hay brincos confusos.
	const rows = await db.select().from(partidos).orderBy(asc(partidos.numero));

	return { partidos: rows, isAdmin: locals.isAdmin };
};

// Captura/edita el marcador REAL de un partido — SOLO admin.
//  • enCurso=false → resultado FINAL.
//  • enCurso=true  → marcador PROVISIONAL en vivo (muestra "Partido en Curso").
// En ambos casos el marcador se guarda igual y cuenta para puntos/posiciones.
async function guardarMarcador({ request, locals }: RequestEvent, enCurso: boolean) {
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
		.set({ golesA, golesB, fecha: new Date(), enCurso })
		.where(eq(partidos.id, partidoId));
	return { ok: true };
}

export const actions: Actions = {
	// Guardado FINAL.
	setResult: (event) => guardarMarcador(event, false),

	// Guardado PARCIAL / en vivo: igual que el final pero marca "Partido en Curso".
	setPartial: (event) => guardarMarcador(event, true),

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
			.set({ golesA: null, golesB: null, fecha: null, enCurso: false })
			.where(eq(partidos.id, partidoId));
		return { ok: true };
	},

	// Reordenar un partido: intercambia su `numero` con el del vecino — SOLO admin.
	// Renumera por swap → los números quedan siempre 1→72 en secuencia; los
	// pronósticos no se tocan (van por id). El nuevo orden aplica en toda la app.
	mover: async ({ request, locals }) => {
		const data = await request.formData();
		const partidoId = Number(data.get('partidoId'));
		const dir = String(data.get('dir'));
		if (!locals.isAdmin) return fail(403, { error: 'Solo el admin.', partidoId });
		if (!Number.isInteger(partidoId) || (dir !== 'up' && dir !== 'down')) {
			return fail(400, { error: 'Movimiento inválido.', partidoId });
		}
		const actual = (await db.select().from(partidos).where(eq(partidos.id, partidoId)))[0];
		if (!actual) return fail(400, { error: 'Partido inválido.', partidoId });

		const vecinoNumero = dir === 'up' ? actual.numero - 1 : actual.numero + 1;
		const vecino = (await db.select().from(partidos).where(eq(partidos.numero, vecinoNumero)))[0];
		if (!vecino) return { ok: true }; // en el borde (#1 o #72): no-op

		// Swap de `numero` (es UNIQUE) con un centinela para no colisionar.
		await db.update(partidos).set({ numero: -1 }).where(eq(partidos.id, actual.id));
		await db.update(partidos).set({ numero: actual.numero }).where(eq(partidos.id, vecino.id));
		await db.update(partidos).set({ numero: vecinoNumero }).where(eq(partidos.id, actual.id));
		return { ok: true };
	}
};
