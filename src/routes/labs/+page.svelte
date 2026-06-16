<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import Bandera from '$lib/Bandera.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Filas editables (URL de Cloudbet + monitoreo) sembradas del load.
	let filas = $state(
		// untrack: copia editable local del formulario; sembrada una vez, no se re-deriva con data.
		untrack(() =>
			data.partidos.map((p) => ({
				id: p.id,
				numero: p.numero,
				equipoA: p.equipoA,
				equipoB: p.equipoB,
				golesA: p.golesA,
				golesB: p.golesB,
				enCurso: p.enCurso,
				url: p.urlCloudbet ?? '',
				urlBase: p.urlCloudbet ?? '',
				monitorear: p.monitorear,
				guardando: false,
				ok: false,
				err: null as string | null
			}))
		)
	);

	let filtro = $state('');
	let soloMon = $state(false);
	const filasVista = $derived(
		filas.filter((f) => {
			if (soloMon && !f.monitorear) return false;
			const q = filtro.trim().toLowerCase();
			if (!q) return true;
			return String(f.numero) === q || `${f.equipoA} ${f.equipoB}`.toLowerCase().includes(q);
		})
	);
	const totalMon = $derived(filas.filter((f) => f.monitorear).length);

	// ── Display en vivo: parte de los monitoreados del load y se refresca por poll.
	type Vivo = {
		id: number;
		numero: number;
		equipoA: string;
		equipoB: string;
		golesA: number | null;
		golesB: number | null;
		enCurso: boolean;
	};
	let vivo = $state<Vivo[]>(
		untrack(() =>
			data.partidos
				.filter((p) => p.monitorear)
				.map((p) => ({
					id: p.id,
					numero: p.numero,
					equipoA: p.equipoA,
					equipoB: p.equipoB,
					golesA: p.golesA,
					golesB: p.golesB,
					enCurso: p.enCurso
				}))
		)
	);
	let conexion = $state(true);

	// ── Probador de URL (sandbox aislado): pega una URL y mira el marcador que lee el lector
	// local (npm run probar). NO toca `partidos` — solo prueba. Sembrado del load.
	let probe = $state(untrack(() => data.probe));
	let probeUrl = $state(untrack(() => data.probe?.url ?? ''));
	let probeBusy = $state(false);

	async function refrescarProbe() {
		try {
			const res = await fetch('/api/monitor/probe');
			if (res.ok) probe = await res.json();
		} catch {
			/* el poll del display ya refleja la conexión */
		}
	}

	async function fijarProbe(url: string) {
		probeBusy = true;
		try {
			await fetch('/api/monitor/probe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url })
			});
			await refrescarProbe();
		} catch {
			/* noop */
		} finally {
			probeBusy = false;
		}
	}

	const probar = () => fijarProbe(probeUrl.trim());
	const limpiarProbe = () => {
		probeUrl = '';
		return fijarProbe('');
	};

	async function refrescarVivo() {
		try {
			const res = await fetch('/api/monitor/estado');
			if (!res.ok) {
				conexion = false;
				return;
			}
			vivo = await res.json();
			conexion = true;
		} catch {
			conexion = false;
		}
	}

	onMount(() => {
		refrescarVivo();
		refrescarProbe();
		const id = setInterval(() => {
			refrescarVivo();
			refrescarProbe();
		}, 7000); // el runner/lector empujan; aquí solo leemos
		return () => clearInterval(id);
	});

	// Guarda la URL + toggle de un partido (POST /api/monitor/target, admin).
	async function guardar(f: (typeof filas)[number]) {
		f.guardando = true;
		f.err = null;
		try {
			const res = await fetch('/api/monitor/target', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ partidoId: f.id, urlCloudbet: f.url, monitorear: f.monitorear })
			});
			if (res.ok) {
				f.urlBase = f.url.trim();
				f.ok = true;
				setTimeout(() => (f.ok = false), 1500);
				refrescarVivo(); // prender/apagar monitoreo cambia qué se ve en vivo
			} else {
				const b = await res.json().catch(() => null);
				f.err = b?.message ?? 'No se pudo guardar.';
			}
		} catch {
			f.err = 'Sin conexión con el servidor.';
		} finally {
			f.guardando = false;
		}
	}

	// ¿El partido ya tiene marcador guardado? (monitorearlo dejaría que el runner lo pise)
	function tieneResultado(f: (typeof filas)[number]) {
		return f.golesA != null && f.golesB != null;
	}

	// Salvaguarda al prender monitoreo sobre un partido que YA tiene marcador. Mensaje según
	// estado: si es FINAL el server igual lo protege (no se sobreescribe); si va en curso, el
	// runner sí lo actualizará. Si se cancela, revierte el toggle.
	function onToggle(f: (typeof filas)[number]) {
		if (f.monitorear && tieneResultado(f)) {
			const msg = !f.enCurso
				? `"${f.equipoA} vs ${f.equipoB}" ya tiene resultado FINAL ${f.golesA}:${f.golesB}. ` +
					`El monitor NO sobreescribe resultados finales (queda protegido en el servidor), así que ` +
					`activarlo no cambiará su marcador. ¿Activar de todas formas?`
				: `"${f.equipoA} vs ${f.equipoB}" ya va ${f.golesA}:${f.golesB} (en curso). Monitorear dejará ` +
					`que el runner lo SOBREESCRIBA con lo que lea de la URL de Cloudbet (cuenta para puntos). ` +
					`Verifica que la URL sea de ESTE partido. ¿Continuar?`;
			if (!confirm('⚠ ' + msg)) {
				f.monitorear = false; // revierte el check
				return;
			}
		}
		guardar(f);
	}

	function onUrlBlur(f: (typeof filas)[number]) {
		if (f.url.trim() !== f.urlBase) guardar(f);
	}

	function estado(v: Vivo): 'vivo' | 'final' | 'espera' {
		if (v.golesA == null || v.golesB == null) return 'espera';
		return v.enCurso ? 'vivo' : 'final';
	}
	const etiqueta = { vivo: '● en vivo', final: 'final', espera: 'esperando' } as const;

	// Recuadro estático: el runner corre en la máquina local del usuario (la página
	// no puede lanzarlo). Solo mostramos el comando para copiarlo.
	const comandoRunner = 'cd C:\\Moibe\\code\\quiniela ; npm run monitor';
	let copiado = $state(false);
	async function copiarComando() {
		try {
			await navigator.clipboard.writeText(comandoRunner);
			copiado = true;
			setTimeout(() => (copiado = false), 1500);
		} catch {
			copiado = false;
		}
	}
</script>

<section class="labs">
	<p class="sub">
		<strong>Monitor de marcadores</strong> (administración). La captura corre <strong
			>fuera de este servidor</strong
		> (un runner local lee Cloudbet y empuja los goles); aquí solo asignas qué vigilar y ves lo que va
		entrando a la base.
	</p>

	<!-- ── Display en vivo ─────────────────────────────────────────────── -->
	<div class="bloque">
		<div class="bloque-head">
			<h2>Marcadores en vivo</h2>
			{#if !conexion}
				<span class="aviso">Sin conexión con el servidor — datos quizá no actuales.</span>
			{/if}
		</div>

		{#if vivo.length}
			<ul class="vivo-list">
				{#each vivo as v (v.id)}
					{@const e = estado(v)}
					<li class="vrow vrow-{e}">
						<span class="vnum">#{v.numero}</span>
						<span class="vteam vteam-a">
							<span class="vname" translate="no">{v.equipoA}</span>
							<Bandera equipo={v.equipoA} />
						</span>
						<span class="vmarcador">{v.golesA ?? '–'} : {v.golesB ?? '–'}</span>
						<span class="vteam vteam-b">
							<Bandera equipo={v.equipoB} />
							<span class="vname" translate="no">{v.equipoB}</span>
						</span>
						<span class="vchip vchip-{e}">{etiqueta[e]}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="vacio">
				No hay partidos en monitoreo. Activa alguno abajo (pega su URL de Cloudbet y prende el
				interruptor).
			</p>
		{/if}
	</div>

	<!-- ── Cómo correr el runner (estático: la página NO lo lanza) ───────── -->
	<div class="bloque">
		<div class="bloque-head"><h2>Correr el monitor (en tu máquina)</h2></div>
		<p class="runner-txt">
			La captura corre <strong>fuera de este servidor</strong>, en tu máquina local (el droplet
			está geo-bloqueado por Cloudbet). Arráncalo una vez y se queda empujando los goles a esta app:
		</p>
		<div class="cmd">
			<code translate="no">{comandoRunner}</code>
			<button type="button" class="copiar" onclick={copiarComando}>
				{copiado ? '✓ copiado' : 'copiar'}
			</button>
		</div>
		<p class="runner-nota">
			Requiere estas variables persistidas una vez en tu máquina:
			<code translate="no">MONITOR_SECRET</code> (el mismo de este servidor),
			<code translate="no">PARTIDO_NAVEGADOR_MODO=lanzar</code> y
			<code translate="no">PARTIDO_CHROME_PATH</code>.
		</p>
	</div>

	<!-- ── Probador de URL (sandbox aislado: NO toca la quiniela) ────────── -->
	<div class="bloque">
		<div class="bloque-head"><h2>Probador de URL</h2></div>
		<p class="runner-txt">
			Pega una URL de Cloudbet y mira el marcador que se lee, <strong>sin tocar la quiniela</strong>
			(es un sandbox en memoria: no escribe en ningún partido ni en resultados). Necesita el lector
			local: corre <code translate="no">npm run probar</code> en tu máquina.
		</p>
		<div class="probe-row">
			<input
				class="url"
				type="url"
				placeholder="https://www.cloudbet.com/…"
				bind:value={probeUrl}
				onkeydown={(e) => e.key === 'Enter' && probar()}
			/>
			<button type="button" class="probe-btn" onclick={probar} disabled={probeBusy}>Probar</button>
			<button
				type="button"
				class="probe-btn ghost"
				onclick={limpiarProbe}
				disabled={probeBusy || !probe?.url}
			>
				Limpiar
			</button>
		</div>
		<div class="probe-out">
			{#if !probe?.url}
				<span class="vacio">Sin URL de prueba.</span>
			{:else if probe.error}
				<span class="probe-err">✗ {probe.error}</span>
			{:else if probe.marcador}
				<span class="probe-marc">
					<span translate="no">{probe.marcador.local ?? '—'}</span>
					<strong>{probe.marcador.golesA ?? '–'} : {probe.marcador.golesB ?? '–'}</strong>
					<span translate="no">{probe.marcador.visita ?? '—'}</span>
					{#if probe.marcador.reloj}
						<span class="probe-reloj">{probe.marcador.periodo ?? ''} {probe.marcador.reloj}</span>
					{/if}
				</span>
			{:else}
				<span class="vacio">
					Esperando lectura… (¿está corriendo <code translate="no">npm run probar</code>?)
				</span>
			{/if}
		</div>
	</div>

	<!-- ── Configuración por partido ───────────────────────────────────── -->
	<div class="bloque">
		<div class="bloque-head">
			<h2>Configurar monitoreo</h2>
			<span class="conteo">{totalMon} en monitoreo · {filas.length} partidos</span>
		</div>

		<div class="filtros">
			<input class="buscar" type="search" placeholder="Buscar (# o equipo)…" bind:value={filtro} />
			<label class="solo"><input type="checkbox" bind:checked={soloMon} /> Solo monitoreados</label>
		</div>

		<div class="tabla-wrap">
			<table class="cfg">
				<thead>
					<tr>
						<th class="c-num">#</th>
						<th class="c-part">Partido</th>
						<th class="c-url">URL de Cloudbet</th>
						<th class="c-tog">Monitorear</th>
						<th class="c-st" aria-label="Estado de guardado"></th>
					</tr>
				</thead>
				<tbody>
					{#each filasVista as f (f.id)}
						<tr class:mon={f.monitorear}>
							<td class="c-num">{f.numero}</td>
							<td class="c-part">
								<span translate="no">{f.equipoA}</span>
								<span class="vs">vs</span>
								<span translate="no">{f.equipoB}</span>
							</td>
							<td class="c-url">
								<input
									class="url"
									type="url"
									placeholder="https://www.cloudbet.com/…"
									bind:value={f.url}
									onblur={() => onUrlBlur(f)}
								/>
							</td>
							<td class="c-tog">
								<input
									class="chk"
									type="checkbox"
									bind:checked={f.monitorear}
									onchange={() => onToggle(f)}
									aria-label="Monitorear partido #{f.numero}"
								/>
							</td>
							<td class="c-st">
								{#if f.guardando}
									<span class="st" title="Guardando…">…</span>
								{:else if f.ok}
									<span class="st ok" title="Guardado">✓</span>
								{:else if f.err}
									<span class="st err" title={f.err}>!</span>
								{:else if f.monitorear && !f.url.trim()}
									<span class="st warn" title="Activo pero sin URL: el runner aún no lo vigila">⚠</span>
								{:else if f.monitorear && tieneResultado(f)}
									<span
										class="st warn"
										title="Ya tiene marcador {f.golesA}:{f.golesB}: el runner puede sobrescribirlo (los finales están protegidos en el servidor)"
									>⚠</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</section>

<style>
	.labs {
		box-sizing: border-box;
		padding: 0.4rem 1.5rem 1.5rem;
		color: rgba(255, 255, 255, 0.95);
	}

	.sub {
		margin: 0.2rem 0 1.2rem;
		font-size: 0.85rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.7);
		max-width: 70ch;
	}

	.bloque {
		margin-bottom: 1.6rem;
	}

	.bloque-head {
		display: flex;
		align-items: baseline;
		gap: 0.9rem;
		flex-wrap: wrap;
		margin-bottom: 0.6rem;
	}

	.bloque-head h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.92);
	}

	.conteo {
		font-size: 0.78rem;
		color: rgba(255, 255, 255, 0.55);
	}

	.aviso {
		font-size: 0.78rem;
		color: #fde68a;
		background: rgba(245, 158, 11, 0.14);
		border: 1px solid rgba(245, 158, 11, 0.4);
		border-radius: 8px;
		padding: 0.15rem 0.55rem;
	}

	/* ── Probador de URL ── */
	.probe-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
		margin-bottom: 0.6rem;
	}
	.probe-row .url {
		flex: 1;
		min-width: 16rem;
	}
	.probe-btn {
		flex-shrink: 0;
		padding: 0.42rem 0.95rem;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.25);
		background: rgba(255, 255, 255, 0.12);
		color: rgba(255, 255, 255, 0.95);
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
	}
	.probe-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.2);
	}
	.probe-btn.ghost {
		background: transparent;
	}
	.probe-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.probe-out {
		min-height: 1.9rem;
		display: flex;
		align-items: center;
		font-size: 0.95rem;
	}
	.probe-marc {
		display: inline-flex;
		align-items: baseline;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.probe-marc strong {
		font-size: 1.15rem;
		font-weight: 800;
	}
	.probe-reloj {
		font-size: 0.78rem;
		color: rgba(255, 255, 255, 0.6);
	}
	.probe-err {
		color: #fca5a5;
		font-size: 0.85rem;
	}

	/* ── Display en vivo ── */
	.vivo-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		max-width: 46rem;
	}

	.vrow {
		display: grid;
		grid-template-columns: 2.6rem 1fr auto 1fr 5.5rem;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.85rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
	}

	.vrow-vivo {
		border-color: rgba(245, 158, 11, 0.55);
		animation: glow 1.9s ease-in-out infinite;
	}

	@keyframes glow {
		0%,
		100% {
			box-shadow: 0 0 6px rgba(245, 158, 11, 0.22);
		}
		50% {
			box-shadow: 0 0 15px rgba(245, 158, 11, 0.5);
		}
	}

	.vnum {
		font-size: 0.72rem;
		color: rgba(255, 255, 255, 0.5);
		font-variant-numeric: tabular-nums;
	}

	.vteam {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.vteam-a {
		justify-content: flex-end;
	}

	.vteam-b {
		justify-content: flex-start;
	}

	.vname {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 700;
		font-size: 0.9rem;
	}

	.vmarcador {
		font-size: 1.25rem;
		font-weight: 700;
		color: #fff;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.vchip {
		justify-self: end;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		white-space: nowrap;
	}

	.vchip-vivo {
		color: #fde68a;
		background: rgba(245, 158, 11, 0.16);
		border: 1px solid rgba(245, 158, 11, 0.45);
	}

	.vchip-final {
		color: #86efac;
		background: rgba(34, 197, 94, 0.14);
		border: 1px solid rgba(34, 197, 94, 0.4);
	}

	.vchip-espera {
		color: rgba(255, 255, 255, 0.55);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.16);
	}

	.vacio {
		margin: 0;
		font-size: 0.88rem;
		color: rgba(255, 255, 255, 0.6);
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		padding: 0.8rem 1rem;
		max-width: 46rem;
	}

	/* ── Recuadro del runner ── */
	.runner-txt {
		margin: 0 0 0.7rem;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.72);
		max-width: 64ch;
	}

	.cmd {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		max-width: 46rem;
	}

	.cmd code {
		flex: 1 1 22rem;
		min-width: 0;
		overflow-x: auto;
		white-space: nowrap;
		padding: 0.5rem 0.7rem;
		font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
		font-size: 0.82rem;
		color: #bbf7d0;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 8px;
	}

	.copiar {
		flex-shrink: 0;
		padding: 0.45rem 0.9rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.9);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 8px;
		cursor: pointer;
		white-space: nowrap;
	}

	.copiar:hover {
		background: rgba(34, 197, 94, 0.16);
		border-color: rgba(34, 197, 94, 0.45);
		color: #fff;
	}

	.runner-nota {
		margin: 0.7rem 0 0;
		font-size: 0.78rem;
		color: rgba(255, 255, 255, 0.55);
		max-width: 64ch;
	}

	.runner-nota code {
		font-size: 0.92em;
		padding: 0.05rem 0.3rem;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 4px;
		color: rgba(255, 255, 255, 0.85);
	}

	/* ── Configuración ── */
	.filtros {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 0.6rem;
	}

	.buscar {
		box-sizing: border-box;
		width: 16rem;
		max-width: 100%;
		padding: 0.4rem 0.7rem;
		font: inherit;
		font-size: 0.85rem;
		color: #fff;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 8px;
	}

	.buscar:focus {
		outline: none;
		border-color: rgba(34, 197, 94, 0.55);
	}

	.solo {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.82rem;
		color: rgba(255, 255, 255, 0.75);
		cursor: pointer;
	}

	.tabla-wrap {
		max-height: 60vh;
		overflow-y: auto;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
	}

	.cfg {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-size: 0.85rem;
	}

	.cfg th,
	.cfg td {
		box-sizing: border-box;
		padding: 0.4rem 0.7rem;
		text-align: left;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
		white-space: nowrap;
	}

	.cfg thead th {
		position: sticky;
		top: 0;
		background: #0a2a19;
		font-size: 0.74rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.85);
		z-index: 1;
	}

	.cfg tbody tr.mon {
		background: rgba(245, 158, 11, 0.08);
	}

	.cfg tbody tr:hover td {
		background: rgba(255, 255, 255, 0.04);
	}

	.c-num {
		width: 3rem;
		color: rgba(255, 255, 255, 0.55);
		font-variant-numeric: tabular-nums;
	}

	.c-part {
		font-weight: 700;
	}

	.c-part .vs {
		font-weight: 400;
		color: rgba(255, 255, 255, 0.4);
		margin: 0 0.2rem;
	}

	.c-url {
		width: 100%;
	}

	.url {
		box-sizing: border-box;
		width: 100%;
		min-width: 14rem;
		padding: 0.3rem 0.55rem;
		font: inherit;
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.95);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 7px;
	}

	.url:focus {
		outline: none;
		border-color: rgba(34, 197, 94, 0.55);
		background: rgba(255, 255, 255, 0.08);
	}

	.url::placeholder {
		color: rgba(255, 255, 255, 0.3);
	}

	.c-tog {
		width: 6rem;
		text-align: center;
	}

	.chk {
		width: 1.15rem;
		height: 1.15rem;
		accent-color: #f59e0b;
		cursor: pointer;
	}

	.c-st {
		width: 2rem;
		text-align: center;
	}

	.st {
		font-weight: 700;
		font-size: 0.9rem;
	}

	.st.ok {
		color: #4ade80;
	}

	.st.err {
		color: #f87171;
		cursor: help;
	}

	.st.warn {
		color: #fbbf24;
		cursor: help;
	}

	@media (max-width: 700px) {
		.vrow {
			grid-template-columns: 2.2rem 1fr auto 1fr;
		}
		.vchip {
			grid-column: 2 / -1;
			justify-self: start;
		}
	}
</style>
