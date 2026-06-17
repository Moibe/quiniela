// Debug: abre la página de LISTADO de Cloudbet (in-play) y, para la fila de un partido (buscado
// por substrings de los dos equipos), reporta lo que necesito para leerlo: nombres, los dos
// marcadores, el MINUTO, y el href del ancestro <a> (para emparejar por ID). Ventana visible.
//
// Uso: node scripts/inspeccionar-listado.mjs "<url del listado in-play>" "Equipo1" "Equipo2"
//   (requiere PARTIDO_CHROME_PATH; substrings tal como aparecen en el listado)
import { chromium } from 'playwright-core';

const [url, eqA, eqB] = process.argv.slice(2);
if (!url || !eqA || !eqB) {
	console.error('Uso: node scripts/inspeccionar-listado.mjs "<url listado>" "Equipo1" "Equipo2"');
	process.exit(1);
}

const browser = await chromium.launch({
	headless: false,
	executablePath: process.env.PARTIDO_CHROME_PATH ?? undefined
});
const page = await browser.newPage();

console.log(`Abriendo listado ${url} …`);
try {
	await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
} catch (e) {
	console.error(`✗ No pude navegar: ${e.message.split('\n')[0]}`);
}
await page.waitForTimeout(8000);
console.log(`Buscando la fila con «${eqA}» y «${eqB}» …\n`);

const r = await page.evaluate(
	({ eqA, eqB }) => {
		const cls = (el) =>
			(typeof el.className === 'string' ? el.className : el.className?.baseVal) || '';
		// Contenedor MÁS CHICO con ambos equipos = la fila.
		let fila = null;
		let minLen = Infinity;
		for (const el of document.querySelectorAll('a,div,li,tr,section')) {
			const txt = el.textContent || '';
			if (txt.includes(eqA) && txt.includes(eqB) && txt.length < minLen) {
				minLen = txt.length;
				fila = el;
			}
		}
		if (!fila) return { ok: false };

		const spans = [...fila.querySelectorAll('span')];
		const nombres = spans.filter((s) => /text-sm/.test(cls(s))).map((s) => s.textContent.trim());
		const marcadores = spans.filter((s) => /text-base/.test(cls(s))).map((s) => s.textContent.trim());

		// Ancestro <a> (para emparejar por ID del href).
		let a = fila;
		let niveles = 0;
		let href = null;
		while (a && niveles < 15) {
			if (a.tagName === 'A') {
				href = a.getAttribute('href');
				break;
			}
			a = a.parentElement;
			niveles++;
		}

		// Minuto: en algún ancestro cercano (la "tarjeta" del partido) hay una hoja tipo "43'".
		let card = fila;
		for (let i = 0; i < 4 && card.parentElement; i++) card = card.parentElement;
		let minuto = null;
		for (const el of card.querySelectorAll('*')) {
			if (el.children.length === 0) {
				const t = (el.textContent || '').trim();
				if (/^\d{1,3}['’]$/.test(t)) {
					minuto = t;
					break;
				}
			}
		}

		return { ok: true, nombres, marcadores, href, hrefNiveles: niveles, minuto };
	},
	{ eqA, eqB }
);

if (!r.ok) {
	console.error(`✗ No encontré fila con «${eqA}» y «${eqB}». ¿Cargó el listado? ¿nombres correctos?`);
} else {
	console.log('===== RESUMEN =====');
	console.log('nombres (text-sm):  ', JSON.stringify(r.nombres));
	console.log('marcadores (text-base):', JSON.stringify(r.marcadores));
	console.log('minuto:             ', r.minuto);
	console.log(`href del <a> ancestro (${r.hrefNiveles} niveles arriba):`, r.href);
	console.log('===================');
}

console.log('\n👀 Ventana abierta. Ctrl+C para cerrar.');
process.on('SIGINT', async () => {
	await browser.close().catch(() => {});
	process.exit(0);
});
await new Promise(() => {});
