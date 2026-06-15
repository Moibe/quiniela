<script lang="ts">
	import { onMount } from 'svelte';
	import type { DatosMarcador, MensajeMonitor, PartidoEstado } from '@moibe/partido-nucleo';

	let url = $state('');
	let activo = $state(false);
	let error = $state<string | null>(null);
	let cargando = $state(false);
	let marcador = $state<DatosMarcador | null>(null);
	let total = $state(0);
	let fuente: EventSource | null = null;

	function aplicar(est: PartidoEstado | undefined) {
		if (!est) return;
		activo = est.activo;
		error = est.error;
		total = est.total;
		if (est.ultimo) marcador = est.ultimo;
	}

	onMount(() => {
		// SSE siempre abierto: muestra el estado actual aunque ya hubiera un monitoreo.
		fuente = new EventSource('/api/labs/monitor/eventos');
		fuente.onmessage = (ev) => {
			const m: MensajeMonitor = JSON.parse(ev.data);
			if (m.tipo === 'snapshot') aplicar(m.partidos[0]);
			else if (m.tipo === 'alta') aplicar(m.estado);
			else if (m.tipo === 'estado') aplicar(m.estado);
			else if (m.tipo === 'evento') {
				marcador = m.evento.marcador;
				total = m.total;
			} else if (m.tipo === 'baja') {
				activo = false;
			}
		};
		return () => fuente?.close();
	});

	async function iniciar() {
		error = null;
		cargando = true;
		try {
			const r = await fetch('/api/labs/monitor/iniciar', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ url })
			});
			if (!r.ok) {
				error = (await r.json().catch(() => ({})))?.message ?? `Error ${r.status}`;
				return;
			}
			activo = true;
		} finally {
			cargando = false;
		}
	}

	async function detener() {
		cargando = true;
		try {
			await fetch('/api/labs/monitor/detener', { method: 'POST' });
			activo = false;
			marcador = null;
			total = 0;
		} finally {
			cargando = false;
		}
	}

	function gol(lado: { minuto: string; jugador: string | null } | null): string {
		if (!lado) return '';
		return `${lado.minuto} ${lado.jugador ?? ''}`.trim();
	}
</script>

<section class="labs">
	<p class="sub">
		Área de experimentos — solo visible en administración. Aquí se probarán funciones nuevas antes
		de pasarlas a las pantallas públicas.
	</p>

	<div class="exp">
		<h2>Monitor de marcador (experimental)</h2>
		<p class="hint">
			Pega la URL de un partido en vivo de Cloudbet y se leerá su marcador en tiempo real. Requiere
			correr quiniela en <strong>local</strong> (en el droplet Cloudbet bloquea por región).
		</p>

		<div class="fila">
			<input
				type="url"
				bind:value={url}
				placeholder="https://www.cloudbet.com/en/sports/soccer/…/12345678"
				disabled={activo}
			/>
			{#if !activo}
				<button class="btn primary" onclick={iniciar} disabled={cargando || !url.trim()}>
					{cargando ? 'Iniciando…' : 'Monitorear'}
				</button>
			{:else}
				<button class="btn" onclick={detener} disabled={cargando}>Detener</button>
			{/if}
		</div>

		<div class="estado">
			<span class="badge" class:on={activo}>{activo ? 'monitoreando' : 'detenido'}</span>
			<span class="muted">{total} cambios</span>
			{#if error}<span class="err">⚠ {error}</span>{/if}
		</div>

		{#if marcador}
			<div class="tablero">
				<div class="periodo">{marcador.periodo ?? '—'} · <strong>{marcador.reloj ?? '—'}</strong></div>
				<div class="cuadro">
					<div class="equipo">
						<span class="nombre">{marcador.local.nombre ?? '—'}</span>
						{#if marcador.local.ultimoGol}<span class="scorer">{gol(marcador.local.ultimoGol)}</span>{/if}
					</div>
					<div class="goles">{marcador.local.goles ?? '–'} : {marcador.visitante.goles ?? '–'}</div>
					<div class="equipo der">
						<span class="nombre">{marcador.visitante.nombre ?? '—'}</span>
						{#if marcador.visitante.ultimoGol}<span class="scorer">{gol(marcador.visitante.ultimoGol)}</span>{/if}
					</div>
				</div>
			</div>
		{:else}
			<p class="empty">Sin lecturas todavía.</p>
		{/if}
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
		color: rgba(255, 255, 255, 0.65);
		max-width: 48rem;
	}
	.exp {
		max-width: 44rem;
		padding: 1.1rem 1.25rem 1.3rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(252, 211, 77, 0.28);
		border-radius: 14px;
	}
	h2 {
		margin: 0 0 0.3rem;
		font-size: 1.05rem;
		color: #fcd34d;
	}
	.hint {
		margin: 0 0 1rem;
		font-size: 0.82rem;
		color: rgba(255, 255, 255, 0.6);
	}
	.fila {
		display: flex;
		gap: 0.5rem;
	}
	input {
		flex: 1;
		padding: 0.55rem 0.75rem;
		font: inherit;
		font-size: 0.9rem;
		color: #fff;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 9px;
	}
	input:disabled {
		opacity: 0.6;
	}
	.btn {
		padding: 0.55rem 1rem;
		font: inherit;
		font-size: 0.88rem;
		color: rgba(255, 255, 255, 0.9);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 9px;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn.primary {
		color: #fff;
		background: rgba(37, 99, 235, 0.35);
		border-color: rgba(37, 99, 235, 0.6);
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.estado {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		margin: 0.8rem 0;
		font-size: 0.8rem;
	}
	.badge {
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.7);
		font-weight: 700;
	}
	.badge.on {
		background: rgba(34, 197, 94, 0.18);
		color: #86efac;
	}
	.muted {
		color: rgba(255, 255, 255, 0.5);
	}
	.err {
		color: #fca5a5;
	}
	.tablero {
		margin-top: 0.4rem;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 12px;
		text-align: center;
	}
	.periodo {
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.7);
		margin-bottom: 0.6rem;
	}
	.cuadro {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
	}
	.equipo {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		text-align: left;
	}
	.equipo.der {
		text-align: right;
	}
	.nombre {
		font-size: 1rem;
		font-weight: 600;
	}
	.scorer {
		font-size: 0.75rem;
		color: #fcd34d;
	}
	.goles {
		font-size: 2rem;
		font-weight: 800;
		letter-spacing: 0.05em;
	}
	.empty {
		margin: 0.4rem 0 0;
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.55);
	}
</style>
