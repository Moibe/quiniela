// Probador de URLs (Labs). Lee la URL de prueba que pones en /labs, captura su marcador de
// Cloudbet con el paquete, y lo empuja al SANDBOX del probador (NO toca `partidos` ni la
// quiniela). Corre en tu máquina local (región OK), igual que el monitor.
//
// Uso (mismas variables que el monitor). Atajo: `npm run probar`.
//   PARTIDO_NAVEGADOR_MODO=lanzar PARTIDO_CHROME_PATH="…\chrome.exe" \
//   MONITOR_SECRET=elsecreto  node scripts/probar.mjs
//
// ⚠ No es parte del build (vite solo bundlea src/); importa @moibe/partido-nucleo solo aquí.
import { monitorMarcadores } from '@moibe/partido-nucleo';

const BASE = (process.env.QUINIELA_URL ?? 'https://noxoroxo.com').replace(/\/+$/, '');
const SECRET = process.env.MONITOR_SECRET ?? '';
const POLL_MS = Number(process.env.MONITOR_PROBE_POLL_MS ?? 5_000); // re-leer la URL de prueba (GET barato; no toca Cloudbet)
const MUESTREO_MS = Number(process.env.MONITOR_MUESTREO_MS ?? 20_000); // cada cuánto leer Cloudbet (DOM)
if (!SECRET) {
	console.error('Falta MONITOR_SECRET (el mismo del .env de quiniela).');
	process.exit(1);
}

const headers = { 'x-monitor-secret': SECRET, 'content-type': 'application/json' };
const seg = (ms) => +(ms / 1000).toFixed(2);
let urlPedida = null; // la URL cruda que pide /labs
let urlCanon = null; // la URL canónica que vigila el paquete

async function pedirUrl() {
	const r = await fetch(`${BASE}/api/monitor/probe/feed`, { headers });
	if (!r.ok) throw new Error(`probe/feed HTTP ${r.status}`);
	return (await r.json()).url ?? null;
}

async function empujar(marcador, error) {
	const body = error
		? { error }
		: {
				golesA: marcador?.local?.goles ?? null,
				golesB: marcador?.visitante?.goles ?? null,
				local: marcador?.local?.nombre ?? marcador?.local?.abrev ?? null,
				visita: marcador?.visitante?.nombre ?? marcador?.visitante?.abrev ?? null,
				reloj: marcador?.reloj ?? null,
				periodo: marcador?.periodo ?? null
			};
	await fetch(`${BASE}/api/monitor/probe/feed`, {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	}).catch(() => {});
}

// Empuja cada lectura: 'evento' = cambio de gol/periodo; 'estado' = heartbeat con reloj vivo.
monitorMarcadores.suscribir((m) => {
	let marcador = null;
	if (m.tipo === 'evento') marcador = m.evento.marcador;
	else if (m.tipo === 'estado') marcador = m.estado.ultimo;
	else return;
	if (urlCanon && m.url === urlCanon && marcador) void empujar(marcador, null);
});

async function reconciliar() {
	let url;
	try {
		url = await pedirUrl();
	} catch (e) {
		console.error('No pude leer la URL de prueba:', e.message);
		return;
	}
	if (url === urlPedida) return; // sin cambios
	if (urlCanon) {
		await monitorMarcadores.quitar(urlCanon).catch(() => {});
		urlCanon = null;
	}
	urlPedida = url;
	if (!url) {
		console.log('— sin URL de prueba (pon una en /labs → Probador)');
		return;
	}
	console.log(`🔎 probando ${url}`);
	try {
		const est = await monitorMarcadores.agregar(url, { muestreoMs: MUESTREO_MS, persistir: false });
		urlCanon = est.url;
	} catch (e) {
		// No reintenta solo (evita relanzar Chrome en bucle). Para reintentar: Limpiar + Probar.
		console.error(`No pude leer ${url}:`, e.message);
		await empujar(null, e.message);
	}
}

for (const sig of ['SIGINT', 'SIGTERM']) {
	process.on(sig, async () => {
		console.log(`\n${sig} → cerrando…`);
		await monitorMarcadores.detenerTodo().catch(() => {});
		process.exit(0);
	});
}

console.log(
	`Probador → ${BASE} (revisa la URL cada ${seg(POLL_MS)} s · lee Cloudbet cada ${seg(MUESTREO_MS)} s). Ctrl+C para salir.`
);
await reconciliar();
setInterval(() => void reconciliar(), POLL_MS);
