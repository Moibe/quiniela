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
// CLOUDBET_RECARGA_MS (recarga anti-stale, def 600000); PARTIDO_HEADLESS=false para ver la ventana.
import { chromium } from 'playwright-core';

const BASE = (process.env.QUINIELA_URL ?? 'https://noxoroxo.com').replace(/\/+$/, '');
const SECRET = process.env.MONITOR_SECRET ?? '';
const LISTADO_URL =
	process.env.CLOUDBET_LISTADO_URL ??
	'https://www.cloudbet.com/en/sports/soccer/international-world-cup?tab=matches';
const MUESTREO_MS = Number(process.env.MONITOR_MUESTREO_MS ?? 20_000); // leer el listado y empujar
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

// Cloudbet sólo da la hora de inicio como texto relativo ("Today • 2:00 PM", "Tomorrow • …", a veces
// "27 Jun • …" o "Sat • …"). La resolvemos a un instante absoluto (epoch) con el reloj de ESTA máquina
// —que se asume en hora de México—, para que la quiniela la guarde y muestre. null si no hay hora.
const MESES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DIAS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
function parseInicioMs(texto, ahoraMs) {
	if (!texto) return null;
	const low = String(texto).toLowerCase();
	const mt = low.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
	if (!mt) return null;
	let hh = Number(mt[1]);
	const mm = Number(mt[2]);
	if (mt[3] === 'pm' && hh < 12) hh += 12;
	if (mt[3] === 'am' && hh === 12) hh = 0;
	const base = new Date(ahoraMs);
	const mk = (y, mo, d) => new Date(y, mo, d, hh, mm, 0, 0).getTime();
	const Y = base.getFullYear();

	if (/tomorrow/.test(low)) {
		const d = new Date(ahoraMs + 86_400_000);
		return mk(d.getFullYear(), d.getMonth(), d.getDate());
	}
	if (/today/.test(low)) return mk(Y, base.getMonth(), base.getDate());

	// Fecha explícita: "27 jun" o "jun 27".
	let dm = low.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
	let day, monStr;
	if (dm) [, day, monStr] = dm;
	else if ((dm = low.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(\d{1,2})/)))
		[, monStr, day] = dm;
	if (day && monStr) {
		const mo = MESES.indexOf(monStr);
		if (mo >= 0) {
			let t = mk(Y, mo, Number(day));
			if (t < ahoraMs - 7 * 86_400_000) t = mk(Y + 1, mo, Number(day)); // cruce de año
			return t;
		}
	}

	// Día de la semana → su próxima ocurrencia.
	for (let i = 0; i < 7; i++) {
		if (new RegExp(`\\b${DIAS[i]}`).test(low)) {
			const d = new Date(ahoraMs + ((i - base.getDay() + 7) % 7) * 86_400_000);
			return mk(d.getFullYear(), d.getMonth(), d.getDate());
		}
	}

	// Sólo hora, sin día (Cloudbet a veces omite "Today" para hoy) → asume hoy.
	return mk(Y, base.getMonth(), base.getDate());
}

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

// Lee el listado del DOM → { vivos, proximos }. EN VIVO = filas con marcador (span.text-base ENTERO,
// cuotas decimales excluidas): { id, nombreA, nombreB, gA, gB, minuto }. PRÓXIMOS = filas sin marcador
// pero con hora de inicio: { id, nombreA, nombreB, inicioTexto } (ej. "Today • 2:00 PM"). nombres =
// span.text-sm; minuto = hoja "45'"; id = número del href de la fila (ancestro <a>).
async function leerListado() {
	return page.evaluate(() => {
		const cls = (el) =>
			(typeof el.className === 'string' ? el.className : el.className?.baseVal) || '';
		const vivos = [];
		const proximos = [];
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
			if (nombres.length < 2) continue; // no es fila de partido (encabezado/nav)
			const scores = spans
				.filter((s) => /text-base/.test(cls(s)) && /^\d{1,3}$/.test((s.textContent || '').trim()))
				.map((s) => (s.textContent || '').trim());
			vistos.add(id);
			if (scores.length >= 2) {
				// EN VIVO: marcador + minuto.
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
				vivos.push({ id, nombreA: nombres[0], nombreB: nombres[1], gA: Number(scores[0]), gB: Number(scores[1]), minuto });
			} else {
				// PRÓXIMO: sin marcador → sacar la hora del TEXTO de la fila (robusto a la estructura del
				// DOM: no dependemos de que la hora viva en un elemento propio). Cloudbet la pone como
				// "<día> • <hora>" al final de la fila, ej. "Today • 2:00 PM", "27 Jun • 9:00 AM".
				const fila = (a.textContent || '').replace(/\s+/g, ' ').trim();
				const m2 =
					fila.match(
						/(?:today|tomorrow|mon|tue|wed|thu|fri|sat|sun|\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*\d{1,2})\s*[•·]?\s*\d{1,2}:\d{2}\s*(?:am|pm)?/i
					) || fila.match(/\d{1,2}:\d{2}\s*(?:am|pm)?/i);
				const inicioTexto = m2 ? m2[0].trim() : null;
				if (inicioTexto) proximos.push({ id, nombreA: nombres[0], nombreB: nombres[1], inicioTexto });
			}
		}
		return { vivos, proximos };
	});
}

async function empujar(ruta, body) {
	return fetch(`${BASE}${ruta}`, { method: 'POST', headers, body: JSON.stringify(body) }).catch(
		() => null
	);
}

// Lee el listado y empuja TODO el catálogo (el server empareja).
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

		let lectura;
		try {
			lectura = await leerListado();
		} catch (e) {
			console.error('Lectura del listado falló, recargo…:', e.message.split('\n')[0]);
			await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
			return;
		}
		const vivos = lectura.vivos;
		const ahora = Date.now();
		// Próximos con su hora ya resuelta a epoch (los que no se pudieron parsear se descartan).
		const proximos = lectura.proximos
			.map((p) => ({ id: p.id, nombreA: p.nombreA, nombreB: p.nombreB, inicioMs: parseInicioMs(p.inicioTexto, ahora) }))
			.filter((p) => p.inicioMs != null);

		const r = await empujar('/api/monitor/catalogo', { matches: vivos, proximos });
		if (r && r.ok) {
			const d = await r.json().catch(() => ({}));
			const faltan = (d.sinEmparejar ?? []).map((m) => `${m.nombreA} vs ${m.nombreB}`);
			console.log(
				`📤 ${vivos.length} con marcador · ${d.emparejados ?? 0} emparejados · ${d.horarios ?? 0} horarios${faltan.length ? ` · sin emparejar: ${faltan.join(', ')}` : ''}`
			);
		} else {
			console.error(`catálogo HTTP ${r ? r.status : 'sin respuesta'}`);
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
	`Runner monitor (catálogo) → ${BASE}\n  listado: ${LISTADO_URL}\n  lee+empuja cada ${seg(MUESTREO_MS)}s. Ctrl+C para salir.`
);
try {
	await abrirListado();
} catch (e) {
	console.error('No pude abrir el listado:', e.message.split('\n')[0]);
	console.error('¿PARTIDO_CHROME_PATH correcto? ¿conexión?');
	process.exit(1);
}
await ciclo();
setInterval(() => void ciclo(), MUESTREO_MS);
// (La recarga anti-stale ya va dentro de ciclo(), serializada, para no chocar con la lectura.)
