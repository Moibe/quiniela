// Debug: abre una URL de Cloudbet en un Chrome VISIBLE y la deja ABIERTA para inspeccionar.
// Intenta leer el marcador (con el MISMO selector y lector que el runner) y lo loguea. Ctrl+C
// para cerrar. NO toca el server ni necesita MONITOR_SECRET — solo abre la página localmente.
// A diferencia del runner, NO bloquea imágenes: ves la página tal cual.
//
// Uso:  node scripts/ver-url.mjs "https://www.cloudbet.com/en/sports/soccer/.../12345?markets-tab=main"
//   (requiere PARTIDO_CHROME_PATH en el entorno, igual que el monitor.)
import { chromium } from 'playwright-core';
import { SELECTOR_MARCADOR, leerMarcador } from '@moibe/partido-nucleo';

const url = process.argv[2];
if (!url) {
	console.error('Uso: node scripts/ver-url.mjs "<url de Cloudbet>"');
	process.exit(1);
}

const browser = await chromium.launch({
	headless: false,
	executablePath: process.env.PARTIDO_CHROME_PATH ?? undefined
});
const page = await browser.newPage();

console.log(`Abriendo ${url} …`);
try {
	await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
	console.log(`Página cargada: ${page.url()}`);
} catch (e) {
	console.error(`✗ No pude navegar: ${e.message.split('\n')[0]}`);
}

console.log(`Buscando el marcador (${SELECTOR_MARCADOR}) …`);
try {
	const seccion = page.locator(SELECTOR_MARCADOR).first();
	await seccion.waitFor({ state: 'visible', timeout: 20_000 });
	const m = await leerMarcador(seccion);
	console.log('✓ Widget encontrado. Marcador leído:');
	console.log(JSON.stringify(m, null, 2));
} catch (e) {
	console.error(`✗ No encontré el widget: ${e.message.split('\n')[0]}`);
	console.error(
		'  Mira la ventana: ¿es la página del partido? ¿está EN VIVO? ¿geo-block / login / cookies?'
	);
}

console.log('\n👀 La ventana queda ABIERTA para inspeccionar. Ctrl+C aquí para cerrarla.');
process.on('SIGINT', async () => {
	await browser.close().catch(() => {});
	process.exit(0);
});
await new Promise(() => {}); // mantener vivo el proceso hasta Ctrl+C
