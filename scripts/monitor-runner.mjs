// Runner local del monitor + probador (Plan A, vía LISTADO). Corre en TU máquina (región OK):
// abre UNA página — el listado de partidos del Mundial en Cloudbet — y lee el marcador NATIVO de
// cada partido (los dos números de la fila), SIN depender del widget de Sportradar. Empareja cada
// partido vigilado con su fila por ID (el del href de la fila == el de la urlCloudbet) y empuja los
// goles a la quiniela (al sandbox). Todo saliente (local→droplet), atraviesa NAT sin abrir puertos.
//
// ⚠ Vive en quiniela/scripts/ pero NO es parte del build de SvelteKit (vite solo bundlea src/).
// Importa playwright-core SOLO aquí; jamás desde src/ (la quiniela debe quedar playwright-free).
//
// Uso (headless). Atajo: `npm run monitor`.
//   PARTIDO_CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
//   MONITOR_SECRET=elsecreto  node scripts/monitor-runner.mjs
//
// Tuning opcional (env): CLOUDBET_LISTADO_URL (otra lista); MONITOR_POLL_MS (re-leer targets, def
// 15000); MONITOR_PROBE_POLL_MS (re-leer URL del probador, def 5000); MONITOR_MUESTREO_MS (leer el
// listado y empujar, def 20000); CLOUDBET_RECARGA_MS (recargar la página anti-stale, def 600000);
// PARTIDO_HEADLESS=false para ver la ventana.
import { chromium } from 'playwright-core';

const BASE = (process.env.QUINIELA_URL ?? 'https://noxoroxo.com').replace(/\/+$/, '');
const SECRET = process.env.MONITOR_SECRET ?? '';
const LISTADO_URL =
	process.env.CLOUDBET_LISTADO_URL ??
	'https://www.cloudbet.com/en/sports/soccer/international-world-cup?tab=matches';
const POLL_MS = Number(process.env.MONITOR_POLL_MS ?? 15_000); // re-leer la lista de targets
const PROBE_POLL_MS = Number(process.env.MONITOR_PROBE_POLL_MS ?? 5_000); // re-leer la URL del probador
const MUESTREO_MS = Number(process.env.MONITOR_MUESTREO_MS ?? 20_000); // leer el listado y empujar
const RECARGA_MS = Number(process.env.CLOUDBET_RECARGA_MS ?? 600_000); // recargar la página (anti-stale)
if (!SECRET) {
	console.error('Falta MONITOR_SECRET (el mismo del .env de quiniela).');
	process.exit(1);
}

const headers = { 'x-monitor-secret': SECRET, 'content-type': 'application/json' };
const seg = (ms) => +(ms / 1000).toFixed(2);
// ID del partido = último segmento numérico del path de la url (detalle) o del href (fila).
const idDe = (url) => {
	const m = String(url ?? '').match(/\/(\d{4,})(?:[/?#]|$)/);
	return m ? m[1] : null;
};

let objetivos = new Map(); // partidoId → { id, equipoA, equipoB }  (qué partidos vigilar)
let probeUrl = null; // url cruda del probador (de /labs)
let listado = new Map(); // id Cloudbet → { A, B, gA, gB, minuto }  (última lectura del listado)
const ultimoPush = new Map(); // partidoId → "gA-gB-final" (dedupe del /score)
let browser = null;
let page = null;

async function abrirListado() {
	browser = await chromium.launch({
		headless: process.env.PARTIDO_HEADLESS !== 'false',
		executablePath: process.env.PARTIDO_CHROME_PATH ?? undefined
	});
	page = await browser.newPage();
	await page.goto(LISTADO_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
	await page.waitForTimeout(6000); // deja que pinte los partidos
	console.log(`📋 Listado abierto: ${LISTADO_URL}`);
}

// Lee el listado del DOM → Map id → { A, B, gA, gB, minuto }. Marcador = los span.text-base con
// valor ENTERO (las cuotas son decimales → excluidas); nombres = los span.text-sm; minuto = la hoja
// tipo "45'"; id = el número del href de la fila (ancestro <a>).
async function leerListado() {
	const filas = await page.evaluate(() => {
		const cls = (el) =>
			(typeof el.className === 'string' ? el.className : el.className?.baseVal) || '';
		const out = [];
		const vistos = new Set();
		for (const a of document.querySelectorAll('a[href*="/sports/soccer/"]')) {
			const href = a.getAttribute('href') || '';
			const m = href.match(/\/(\d{4,})(?:[/?#]|$)/);
			if (!m) continue;
			const id = m[1];
			if (vistos.has(id)) continue;
			const spans = [...a.querySelectorAll('span')];
			const nombres = spans
				.filter((s) => /text-sm/.test(cls(s)))
				.map((s) => (s.textContent || '').trim())
				.filter(Boolean);
			const scores = spans
				.filter((s) => /text-base/.test(cls(s)) && /^\d{1,3}$/.test((s.textContent || '').trim()))
				.map((s) => (s.textContent || '').trim());
			if (scores.length < 2) continue; // fila sin marcador (aún no en vivo)
			let minuto = null;
			for (const el of a.querySelectorAll('*')) {
				if (el.children.length === 0) {
					const t = (el.textContent || '').trim();
					if (/^\d{1,3}['’]$/.test(t)) {
						minuto = t;
						break;
					}
				}
			}
			vistos.add(id);
			out.push({ id, A: nombres[0] ?? null, B: nombres[1] ?? null, gA: Number(scores[0]), gB: Number(scores[1]), minuto });
		}
		return out;
	});
	listado = new Map(filas.map((f) => [f.id, f]));
}

async function empujar(ruta, body) {
	await fetch(`${BASE}${ruta}`, { method: 'POST', headers, body: JSON.stringify(body) }).catch(
		() => {}
	);
}

// Qué partidos vigilar (de la quiniela). También sirve de latido del runner.
async function refrescarObjetivos() {
	try {
		const r = await fetch(`${BASE}/api/monitor/targets`, { headers });
		if (!r.ok) throw new Error(`targets HTTP ${r.status}`);
		const lista = await r.json();
		objetivos = new Map(
			lista.map((t) => [t.partidoId, { id: idDe(t.url), equipoA: t.equipoA, equipoB: t.equipoB }])
		);
	} catch (e) {
		console.error('No pude leer targets:', e.message);
	}
}

// URL del probador (de /labs). Latido también.
async function refrescarProbe() {
	try {
		const r = await fetch(`${BASE}/api/monitor/probe/feed`, { headers });
		if (r.ok) probeUrl = (await r.json()).url ?? null;
	} catch {
		/* si /probe/feed aún no está desplegado, ignora */
	}
}

// Lee el listado y empuja: monitor (cada objetivo que esté en el listado, dedup por marcador) +
// probador (la url de prueba, si está en el listado).
async function ciclo() {
	if (!page) return;
	try {
		await leerListado();
	} catch (e) {
		console.error('Lectura del listado falló, recargo…:', e.message.split('\n')[0]);
		await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
		return;
	}

	for (const [partidoId, o] of objetivos) {
		const d = o.id ? listado.get(o.id) : null;
		if (!d) continue; // no está en vivo en el listado → "esperando" (no spamea)
		const final = !d.minuto;
		const clave = `${d.gA}-${d.gB}-${final ? 'F' : 'V'}`;
		if (ultimoPush.get(partidoId) === clave) continue; // sin cambio
		ultimoPush.set(partidoId, clave);
		await empujar('/api/monitor/score', { partidoId, golesA: d.gA, golesB: d.gB, final });
		console.log(
			`→ ${o.equipoA} vs ${o.equipoB}: ${d.gA}-${d.gB}${d.minuto ? ` (${d.minuto})` : ' (final)'}`
		);
	}

	const pid = idDe(probeUrl);
	if (pid) {
		const d = listado.get(pid);
		if (d) await empujar('/api/monitor/probe/feed', { golesA: d.gA, golesB: d.gB, local: d.A, visita: d.B, reloj: d.minuto });
		else await empujar('/api/monitor/probe/feed', { error: 'No aparece en el listado (¿es del Mundial y está en vivo?).' });
	}
}

for (const sig of ['SIGINT', 'SIGTERM']) {
	process.on(sig, async () => {
		console.log(`\n${sig} → cerrando…`);
		await browser?.close().catch(() => {});
		process.exit(0);
	});
}

console.log(
	`Runner monitor (listado) → ${BASE}\n  listado: ${LISTADO_URL}\n  targets cada ${seg(POLL_MS)}s · probador cada ${seg(PROBE_POLL_MS)}s · lee+empuja cada ${seg(MUESTREO_MS)}s. Ctrl+C para salir.`
);
try {
	await abrirListado();
} catch (e) {
	console.error('No pude abrir el listado:', e.message.split('\n')[0]);
	console.error('¿PARTIDO_CHROME_PATH correcto? ¿conexión?');
	process.exit(1);
}
await refrescarObjetivos();
await refrescarProbe();
await ciclo();
setInterval(() => void refrescarObjetivos(), POLL_MS);
setInterval(() => void refrescarProbe(), PROBE_POLL_MS);
setInterval(() => void ciclo(), MUESTREO_MS);
setInterval(() => void page?.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {}), RECARGA_MS);
