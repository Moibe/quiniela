// Runner local del monitor (Plan A, vía LISTADO + auto-emparejado por nombre). Corre en TU máquina
// (región OK): abre UNA página — el listado de partidos del Mundial en Cloudbet — lee el marcador
// NATIVO de cada fila (sin widget de Sportradar) y empuja TODO el catálogo a la quiniela. El SERVER
// empareja cada partido con tu quiniela por NOMBRE (o por ID si pusiste URL de override) y escribe
// el marcador en el sandbox. Tú NO pegas URLs por partido. Todo saliente (local→droplet).
//
// ⚠ Vive en quiniela/scripts/ pero NO es parte del build (vite solo bundlea src/). Importa
// playwright-core SOLO aquí; jamás desde src/ (la quiniela debe quedar playwright-free).
//
// Uso (headless). Atajo: `npm run monitor`.
//   PARTIDO_CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" \
//   MONITOR_SECRET=elsecreto  node scripts/monitor-runner.mjs
//
// Tuning env: CLOUDBET_LISTADO_URL (otra lista); MONITOR_MUESTREO_MS (leer+empujar, def 20000);
// MONITOR_PROBE_POLL_MS (re-leer URL del probador, def 5000); CLOUDBET_RECARGA_MS (recarga
// anti-stale, def 600000); PARTIDO_HEADLESS=false para ver la ventana.
import { chromium } from 'playwright-core';

const BASE = (process.env.QUINIELA_URL ?? 'https://noxoroxo.com').replace(/\/+$/, '');
const SECRET = process.env.MONITOR_SECRET ?? '';
const LISTADO_URL =
	process.env.CLOUDBET_LISTADO_URL ??
	'https://www.cloudbet.com/en/sports/soccer/international-world-cup?tab=matches';
const MUESTREO_MS = Number(process.env.MONITOR_MUESTREO_MS ?? 20_000); // leer el listado y empujar
const PROBE_POLL_MS = Number(process.env.MONITOR_PROBE_POLL_MS ?? 5_000); // re-leer la URL del probador
const RECARGA_MS = Number(process.env.CLOUDBET_RECARGA_MS ?? 600_000); // recargar la página (anti-stale)
const CICLOS_RECARGA = Math.max(1, Math.round(RECARGA_MS / MUESTREO_MS)); // recarga cada N ciclos (serializada)
if (!SECRET) {
	console.error('Falta MONITOR_SECRET (el mismo del .env de quiniela).');
	process.exit(1);
}

const headers = { 'x-monitor-secret': SECRET, 'content-type': 'application/json' };
const seg = (ms) => +(ms / 1000).toFixed(2);
const idDe = (url) => {
	const m = String(url ?? '').match(/\/(\d{4,})(?:[/?#]|$)/);
	return m ? m[1] : null;
};

let probeUrl = null; // url cruda del probador (de /labs)
let browser = null;
let page = null;
let ocupado = false; // un ciclo en vuelo no dispara otro encima (evita choque de page.evaluate)
let ciclosDesdeRecarga = 0;

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

// Lee el listado del DOM → [{ id, nombreA, nombreB, gA, gB, minuto }]. Marcador = los span.text-base
// con valor ENTERO (cuotas decimales → excluidas); nombres = span.text-sm; minuto = hoja "45'";
// id = número del href de la fila (ancestro <a>).
async function leerListado() {
	return page.evaluate(() => {
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
			if (nombres.length < 2 || scores.length < 2) continue; // fila sin marcador (no en vivo)
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
			out.push({ id, nombreA: nombres[0], nombreB: nombres[1], gA: Number(scores[0]), gB: Number(scores[1]), minuto });
		}
		return out;
	});
}

async function empujar(ruta, body) {
	return fetch(`${BASE}${ruta}`, { method: 'POST', headers, body: JSON.stringify(body) }).catch(
		() => null
	);
}

// URL del probador (de /labs). Latido también.
async function refrescarProbe() {
	try {
		const r = await fetch(`${BASE}/api/monitor/probe/feed`, { headers });
		if (r.ok) probeUrl = (await r.json()).url ?? null;
	} catch {
		/* si /probe/feed aún no está, ignora */
	}
}

// Lee el listado y empuja TODO el catálogo (el server empareja). Más el probador.
async function ciclo() {
	if (!page || ocupado) return; // no encimar ciclos (un agregar/recarga lento no dispara otro)
	ocupado = true;
	try {
		// Recarga periódica SERIALIZADA con la lectura (mismo flujo) para no chocar con un
		// page.evaluate en vuelo ("Execution context was destroyed"). Cada CICLOS_RECARGA ciclos.
		if (++ciclosDesdeRecarga >= CICLOS_RECARGA) {
			ciclosDesdeRecarga = 0;
			await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
			await page.waitForTimeout(4000);
		}

		let filas;
		try {
			filas = await leerListado();
		} catch (e) {
			console.error('Lectura del listado falló, recargo…:', e.message.split('\n')[0]);
			await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
			return;
		}

		const r = await empujar('/api/monitor/catalogo', { matches: filas });
		if (r && r.ok) {
			const d = await r.json().catch(() => ({}));
			const faltan = (d.sinEmparejar ?? []).map((m) => `${m.nombreA} vs ${m.nombreB}`);
			console.log(
				`📤 ${filas.length} con marcador · ${d.emparejados ?? 0} emparejados${faltan.length ? ` · sin emparejar: ${faltan.join(', ')}` : ''}`
			);
		} else {
			console.error(`catálogo HTTP ${r ? r.status : 'sin respuesta'}`);
		}

		const pid = idDe(probeUrl);
		if (pid) {
			const d = filas.find((f) => f.id === pid);
			if (d) await empujar('/api/monitor/probe/feed', { golesA: d.gA, golesB: d.gB, local: d.nombreA, visita: d.nombreB, reloj: d.minuto });
			else await empujar('/api/monitor/probe/feed', { error: 'No aparece en el listado (¿es del Mundial y en vivo?).' });
		}
	} finally {
		ocupado = false;
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
	`Runner monitor (catálogo) → ${BASE}\n  listado: ${LISTADO_URL}\n  lee+empuja cada ${seg(MUESTREO_MS)}s · probador cada ${seg(PROBE_POLL_MS)}s. Ctrl+C para salir.`
);
try {
	await abrirListado();
} catch (e) {
	console.error('No pude abrir el listado:', e.message.split('\n')[0]);
	console.error('¿PARTIDO_CHROME_PATH correcto? ¿conexión?');
	process.exit(1);
}
await refrescarProbe();
await ciclo();
setInterval(() => void ciclo(), MUESTREO_MS);
setInterval(() => void refrescarProbe(), PROBE_POLL_MS);
// (La recarga anti-stale ya va dentro de ciclo(), serializada, para no chocar con la lectura.)
