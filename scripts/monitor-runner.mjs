// Runner local del monitor (Plan A). Corre en TU máquina (región permitida):
// pregunta a quiniela qué partidos vigilar, lee sus marcadores de Cloudbet con el
// paquete, y empuja los goles de vuelta a quiniela. Todo saliente (local→droplet),
// así que atraviesa NAT sin abrir puertos.
//
// ⚠ Vive en quiniela/scripts/ pero NO es parte del build de SvelteKit (vite solo
// bundlea src/). Importa @moibe/partido-nucleo (→ playwright-core) SOLO aquí; jamás
// desde src/, o se rompe el build (quiniela debe quedar playwright-free).
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
// Tuning opcional (env): MONITOR_POLL_MS = cada cuánto re-leer la lista de targets
// (default 15000); MONITOR_MUESTREO_MS = cada cuánto leer el marcador de Cloudbet
// (default 20000, mínimo 250). Súbelos para checar menos seguido.
import { monitorMarcadores } from '@moibe/partido-nucleo';

const BASE = (process.env.QUINIELA_URL ?? 'https://noxoroxo.com').replace(/\/+$/, '');
const SECRET = process.env.MONITOR_SECRET ?? '';
const POLL_MS = Number(process.env.MONITOR_POLL_MS ?? 15_000); // cada cuánto re-leer targets
const MUESTREO_MS = Number(process.env.MONITOR_MUESTREO_MS ?? 20_000); // cada cuánto leer el marcador de Cloudbet (DOM)
if (!SECRET) {
	console.error('Falta MONITOR_SECRET (el mismo del .env de quiniela).');
	process.exit(1);
}

const headers = { 'x-monitor-secret': SECRET, 'content-type': 'application/json' };
const porPartido = new Map(); // partidoId → url canónica (lo que vigilamos)
const porUrl = new Map(); // url canónica → partidoId (para mapear eventos)

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

// Empuja en cada gol/cambio de periodo. m.url es la url canónica → partidoId.
monitorMarcadores.suscribir((m) => {
	if (m.tipo !== 'evento') return;
	const partidoId = porUrl.get(m.url);
	if (partidoId) void empujar(partidoId, m.evento.marcador);
});

// Reconcilia el registro contra lo que quiniela pide: agrega lo nuevo, quita lo viejo.
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

// Cierre limpio en Ctrl+C (SIGINT) y en pm2 stop/restart (SIGTERM): cierra el
// navegador para no dejar Chromes zombies acumulándose entre reinicios.
for (const sig of ['SIGINT', 'SIGTERM']) {
	process.on(sig, async () => {
		console.log(`\n${sig} → cerrando…`);
		await monitorMarcadores.detenerTodo().catch(() => {});
		process.exit(0);
	});
}

const seg = (ms) => +(ms / 1000).toFixed(2); // ms → s, sin ceros sobrantes (15000→15, 1500→1.5)
console.log(
	`Runner monitor → ${BASE} (targets cada ${seg(POLL_MS)} s · marcador cada ${seg(MUESTREO_MS)} s). Ctrl+C para salir.`
);
await reconciliar();
setInterval(() => void reconciliar(), POLL_MS);
