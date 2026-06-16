// Runner local del monitor + probador (Plan A). Corre en TU máquina (región permitida):
// pregunta a quiniela qué partidos vigilar, lee sus marcadores de Cloudbet con el paquete, y
// empuja los goles de vuelta a quiniela. ADEMÁS atiende el "Probador de URL" de /labs: lee la
// URL de prueba y la empuja a un sandbox aparte (NO toca `partidos`). Todo saliente
// (local→droplet), así que atraviesa NAT sin abrir puertos.
//
// ⚠ Vive en quiniela/scripts/ pero NO es parte del build de SvelteKit (vite solo bundlea
// src/). Importa @moibe/partido-nucleo (→ playwright-core) SOLO aquí; jamás desde src/, o se
// rompe el build (quiniela debe quedar playwright-free).
//
// Uso (headless local, sin login — recomendado). Atajo: `npm run monitor`.
//   PARTIDO_NAVEGADOR_MODO=lanzar \
//   PARTIDO_CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
//   QUINIELA_URL=https://noxoroxo.com \
//   MONITOR_SECRET=elsecreto \
//   node scripts/monitor-runner.mjs
//
// (Sin PARTIDO_NAVEGADOR_MODO usa modo conectar → necesita el Chrome dedicado en :9222.)
//
// Tuning opcional (env): MONITOR_POLL_MS = re-leer la lista de targets (default 15000);
// MONITOR_PROBE_POLL_MS = re-leer la URL del probador (default 5000); MONITOR_MUESTREO_MS =
// leer el marcador de Cloudbet (default 20000, mínimo 250). Súbelos para checar menos seguido.
import { monitorMarcadores } from '@moibe/partido-nucleo';

const BASE = (process.env.QUINIELA_URL ?? 'https://noxoroxo.com').replace(/\/+$/, '');
const SECRET = process.env.MONITOR_SECRET ?? '';
const POLL_MS = Number(process.env.MONITOR_POLL_MS ?? 15_000); // cada cuánto re-leer targets
const PROBE_POLL_MS = Number(process.env.MONITOR_PROBE_POLL_MS ?? 5_000); // re-leer URL del probador (GET barato)
const MUESTREO_MS = Number(process.env.MONITOR_MUESTREO_MS ?? 20_000); // cada cuánto leer el marcador de Cloudbet (DOM)
if (!SECRET) {
	console.error('Falta MONITOR_SECRET (el mismo del .env de quiniela).');
	process.exit(1);
}

const headers = { 'x-monitor-secret': SECRET, 'content-type': 'application/json' };
const seg = (ms) => +(ms / 1000).toFixed(2);
const porPartido = new Map(); // partidoId → url canónica (lo que vigilamos)
const porUrl = new Map(); // url canónica → partidoId (para mapear eventos)

// ── Monitor: lee qué vigilar y empuja goles a `partidos` ──────────────────
async function targets() {
	const r = await fetch(`${BASE}/api/monitor/targets`, { headers });
	if (!r.ok) throw new Error(`targets HTTP ${r.status}`);
	return r.json(); // [{ partidoId, numero, equipoA, equipoB, url }]
}

async function empujar(partidoId, marcador) {
	const golesA = marcador.local?.goles;
	const golesB = marcador.visitante?.goles;
	if (golesA == null || golesB == null) return; // aún no hay marcador legible
	const r = await fetch(`${BASE}/api/monitor/score`, {
		method: 'POST',
		headers,
		body: JSON.stringify({ partidoId, golesA, golesB })
	});
	if (!r.ok) console.error(`  score HTTP ${r.status} (partido ${partidoId})`);
	else console.log(`  → partido ${partidoId}: ${golesA}-${golesB} (${marcador.reloj ?? '?'})`);
}

// ── Probador: lee la URL de prueba de /labs y la empuja a un sandbox aparte ─
let probePedida = null; // la URL cruda que pide /labs
let probeCanon = null; // la URL canónica que vigila el paquete

async function probeTarget() {
	const r = await fetch(`${BASE}/api/monitor/probe/feed`, { headers });
	if (!r.ok) throw new Error(`probe/feed HTTP ${r.status}`);
	return (await r.json()).url ?? null;
}

async function empujarProbe(marcador, error) {
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

// Un solo suscriptor: enruta cada lectura a /score (monitor) o /probe/feed (probador).
monitorMarcadores.suscribir((m) => {
	// Monitor: empuja a `partidos` solo en eventos (gol/cambio de periodo).
	if (m.tipo === 'evento') {
		const partidoId = porUrl.get(m.url);
		if (partidoId) void empujar(partidoId, m.evento.marcador);
	}
	// Probador: empuja al sandbox en evento y en heartbeat (para el reloj vivo).
	if (probeCanon && m.url === probeCanon) {
		const marc =
			m.tipo === 'evento' ? m.evento.marcador : m.tipo === 'estado' ? m.estado.ultimo : null;
		if (marc) void empujarProbe(marc, null);
	}
});

// Reconcilia el monitoreo contra lo que pide quiniela: agrega lo nuevo, quita lo viejo.
async function reconciliar() {
	let lista;
	try {
		lista = await targets();
	} catch (e) {
		console.error('No pude leer targets:', e.message);
		return;
	}
	const deseados = new Map(lista.map((t) => [t.partidoId, t]));

	for (const t of lista) {
		if (porPartido.has(t.partidoId)) continue;
		try {
			const est = await monitorMarcadores.agregar(t.url, { muestreoMs: MUESTREO_MS });
			porPartido.set(t.partidoId, est.url);
			porUrl.set(est.url, t.partidoId);
			console.log(`+ vigilando ${t.equipoA} vs ${t.equipoB} (#${t.numero}, partido ${t.partidoId})`);
		} catch (e) {
			console.error(`No pude agregar ${t.url}:`, e.message);
		}
	}
	for (const [pid, url] of [...porPartido]) {
		if (!deseados.has(pid)) {
			await monitorMarcadores.quitar(url).catch(() => {});
			porPartido.delete(pid);
			porUrl.delete(url);
			console.log(`- dejé de vigilar partido ${pid}`);
		}
	}
}

// Reconcilia el probador: sigue la URL que pusiste en /labs (o ninguna).
async function reconciliarProbe() {
	let url;
	try {
		url = await probeTarget();
	} catch {
		return; // si /probe/feed aún no está desplegado, no spamea
	}
	if (url === probePedida) return; // sin cambios
	if (probeCanon) {
		// no sueltes un partido que TAMBIÉN se está monitoreando (lo comparte el monitor).
		if (!porUrl.has(probeCanon)) await monitorMarcadores.quitar(probeCanon).catch(() => {});
		probeCanon = null;
	}
	probePedida = url;
	if (!url) return;
	console.log(`🔎 probando ${url}`);
	try {
		const est = await monitorMarcadores.agregar(url, { muestreoMs: MUESTREO_MS, persistir: false });
		probeCanon = est.url;
	} catch (e) {
		// No reintenta solo (evita relanzar Chrome en bucle). Reintentar: Limpiar + Probar en /labs.
		console.error(`Probador: no pude leer ${url}:`, e.message);
		await empujarProbe(null, e.message);
	}
}

// Cierre limpio en Ctrl+C (SIGINT) y en pm2 stop/restart (SIGTERM): cierra el navegador para no
// dejar Chromes zombies acumulándose entre reinicios.
for (const sig of ['SIGINT', 'SIGTERM']) {
	process.on(sig, async () => {
		console.log(`\n${sig} → cerrando…`);
		await monitorMarcadores.detenerTodo().catch(() => {});
		process.exit(0);
	});
}

console.log(
	`Runner monitor → ${BASE} (targets cada ${seg(POLL_MS)} s · probador cada ${seg(PROBE_POLL_MS)} s · marcador cada ${seg(MUESTREO_MS)} s). Ctrl+C para salir.`
);
await reconciliar();
await reconciliarProbe();
setInterval(() => void reconciliar(), POLL_MS);
setInterval(() => void reconciliarProbe(), PROBE_POLL_MS);
