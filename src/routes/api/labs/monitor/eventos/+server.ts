// GET /api/labs/monitor/eventos — stream SSE del monitoreo experimental (Labs, solo
// admin): snapshot al conectar, luego altas/bajas, eventos (gol/periodo) y heartbeats
// con el reloj vivo. Cada mensaje trae su `url`.
import { error } from '@sveltejs/kit';
import { monitorMarcadores, type MensajeMonitor } from '@moibe/partido-nucleo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
	if (!locals.isAdmin) error(403, 'Solo admin.');

	const enc = new TextEncoder();
	let desuscribir: (() => void) | undefined;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const enviar = (m: MensajeMonitor) => {
				try {
					controller.enqueue(enc.encode(`data: ${JSON.stringify(m)}\n\n`));
				} catch {
					// El cliente cerró; cancel() desuscribe.
				}
			};
			enviar(monitorMarcadores.snapshot());
			desuscribir = monitorMarcadores.suscribir(enviar);
		},
		cancel() {
			desuscribir?.();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
