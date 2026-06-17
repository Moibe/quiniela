// Debug/lector: abre el LISTADO in-play de Cloudbet y lee TODOS los partidos (id del href +
// equipos + marcador + minuto), reimprimiendo cada 5 s. Sirve para VERIFICAR que los selectores
// del lector aciertan en todas las filas antes de cablearlo al runner. Ventana visible; Ctrl+C
// para cerrar. NO toca el server. (requiere PARTIDO_CHROME_PATH)
//
// Uso: node scripts/leer-listado.mjs ["<url del listado>"]   (default: live?s=soccer)
import { chromium } from 'playwright-core';

const URL = process.argv[2] ?? 'https://www.cloudbet.com/en/sports/live?s=soccer';

const browser = await chromium.launch({
	headless: false,
	executablePath: process.env.PARTIDO_CHROME_PATH ?? undefined
});
const page = await browser.newPage();
console.log(`Abriendo ${URL} …`);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForTimeout(7000);

// Lee el listado → [{ id, A, B, gA, gB, minuto }]. El id sale del href de la fila (ancestro <a>);
// los marcadores son los span.text-base con valor ENTERO (las cuotas son decimales → excluidas).
async function leer() {
	return page.evaluate(() => {
		const cls = (el) =>
			(typeof el.className === 'string' ? el.className : el.className?.baseVal) || '';
		const filas = [];
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
			filas.push({ id, A: nombres[0], B: nombres[1], gA: scores[0], gB: scores[1], minuto });
		}
		return filas;
	});
}

console.log('Leyendo cada 5 s (Ctrl+C para salir). Compara con lo que ves en pantalla:\n');
async function tick() {
	try {
		const filas = await leer();
		console.log(`──── ${filas.length} partidos con marcador ────`);
		for (const f of filas) {
			console.log(`  #${f.id}  ${f.A} ${f.gA}-${f.gB} ${f.B}${f.minuto ? `  ${f.minuto}` : ''}`);
		}
		console.log('');
	} catch (e) {
		console.error('lectura falló:', e.message.split('\n')[0]);
	}
}
await tick();
const iv = setInterval(tick, 5000);
process.on('SIGINT', async () => {
	clearInterval(iv);
	await browser.close().catch(() => {});
	process.exit(0);
});
await new Promise(() => {});
