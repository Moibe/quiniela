<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import Bandera from '$lib/Bandera.svelte';
	import TablaGrupo from '$lib/TablaGrupo.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let enCurso = $state(untrack(() => data.enCurso));
	let proximos = $state(untrack(() => data.proximos));
	let grupos = $state(untrack(() => data.grupos));
	let terceros = $state(untrack(() => data.terceros));
	let conexion = $state(true);

	async function refrescar() {
		try {
			const res = await fetch('/api/en-vivo');
			if (!res.ok) {
				conexion = false;
				return;
			}
			const d = await res.json();
			enCurso = d.enCurso;
			proximos = d.proximos;
			grupos = d.grupos;
			terceros = d.terceros;
			conexion = true;
		} catch {
			conexion = false;
		}
	}

	function hace(ms: number | null): string {
		if (ms == null) return '';
		const min = Math.round(ms / 60000);
		if (min < 60) return `hace ${Math.max(1, min)}m`;
		const h = Math.floor(min / 60);
		return `hace ${h}h ${min % 60}m`;
	}

	// Hora de inicio de un próximo partido (epoch que el monitor resolvió de Cloudbet). Se muestra
	// SIEMPRE en hora de México y formato fijo, para que SSR y cliente coincidan (sin parpadeo de
	// hidratación) sin importar la zona horaria de quien mira.
	function fmtInicio(ms: number | null): string {
		if (ms == null) return '';
		const TZ = 'America/Mexico_City';
		const ymd = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ }); // AAAA-MM-DD en hora MX
		const d = new Date(ms);
		const ahora = new Date();
		const manana = new Date(ahora.getTime() + 86_400_000);
		const hora = d.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
		let dia: string;
		if (ymd(d) === ymd(ahora)) dia = 'hoy';
		else if (ymd(d) === ymd(manana)) dia = 'mañana';
		else dia = d.toLocaleDateString('es-MX', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
		return `${dia} · ${hora}`;
	}

	onMount(() => {
		const id = setInterval(refrescar, 10000); // se actualiza solo
		return () => clearInterval(id);
	});
</script>

<section class="envivo">
	<div class="head">
		<h1>En Vivo</h1>
		{#if !conexion}
			<span class="aviso">Sin conexión — datos quizá no actuales.</span>
		{/if}
	</div>
	<p class="sub">
		{enCurso.length
			? 'Marcadores de los partidos que se están jugando ahora mismo.'
			: 'Ahora mismo no hay partidos en curso.'}
	</p>

	{#if enCurso.length}
		<ul class="lista">
			{#each enCurso as m (m.numero)}
				<li class="vrow" class:desconectado={m.estado === 'desconectado'} class:terminado={m.estado === 'terminado'} class:proximo={m.estado === 'porEmpezar'}>
					{#if m.estado === 'vivo'}
						<span class="chip"><span class="dot" aria-hidden="true"></span> en vivo{#if m.minuto}{' · ' + m.minuto}{/if}</span>
					{:else if m.estado === 'terminado'}
						<span class="chip fin"><span class="dot fin" aria-hidden="true"></span> Finalizado · {hace(m.haceMs)}</span>
					{:else if m.estado === 'porEmpezar'}
						<span class="chip prox"><span class="dot prox" aria-hidden="true"></span> por empezar</span>
					{:else}
						<span class="chip off"><span class="dot off" aria-hidden="true"></span> desconectado · {hace(m.haceMs)}</span>
					{/if}
					{#if m.estado !== 'porEmpezar'}
						<span class="src" class:manual={m.fuente === 'manual'}>{m.fuente === 'monitor' ? 'automático' : m.fuente}</span>
					{/if}
					<span class="vnum">#{m.numero}</span>
					<span class="team a">
						<span class="nm" translate="no">{m.equipoA}</span>
						<Bandera equipo={m.equipoA} />
					</span>
					{#if m.estado === 'porEmpezar'}
						<span class="marc vs">vs</span>
					{:else}
						<span class="marc">{m.golesA ?? '–'} : {m.golesB ?? '–'}</span>
					{/if}
					<span class="team b">
						<Bandera equipo={m.equipoB} />
						<span class="nm" translate="no">{m.equipoB}</span>
					</span>
				</li>
			{/each}
		</ul>

	{:else if proximos.length}
		<h2 class="prox-titulo">
			Próximos partidos
			<span class="g-nota">los dos siguientes del calendario</span>
		</h2>
		<ul class="lista">
			{#each proximos as m (m.numero)}
				<li class="vrow proximo">
					<span class="chip prox"><span class="dot prox" aria-hidden="true"></span> {m.inicioMs ? `próximo · ${fmtInicio(m.inicioMs)}` : 'próximo'}</span>
					<span class="vnum">#{m.numero}</span>
					<span class="team a">
						<span class="nm" translate="no">{m.equipoA}</span>
						<Bandera equipo={m.equipoA} />
					</span>
					<span class="marc vs">vs</span>
					<span class="team b">
						<Bandera equipo={m.equipoB} />
						<span class="nm" translate="no">{m.equipoB}</span>
					</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="vacio">No hay partidos en curso ni próximos: la fase de grupos terminó.</p>
	{/if}

		{#if grupos.length}
			<div class="lado-grupos">
				<h2 class="g-titulo">
			{#if enCurso.length}
				{grupos.length === 1 ? 'Tabla del grupo en juego' : 'Tablas de los grupos en juego'}
				<span class="g-nota">incluye el marcador en curso</span>
			{:else}
				{grupos.length === 1 ? 'Tabla del grupo' : 'Tablas de los grupos'}
				<span class="g-nota">posiciones actuales · se actualiza en vivo durante el partido</span>
			{/if}
		</h2>
		<div class="grid" style="--cols:{Math.min(grupos.length, 2)}">
			{#each grupos as g (g.label)}
				<TablaGrupo grupo={g} qlf vivo />
			{/each}
		</div>
			</div>
		{/if}
</section>

<style>
	.envivo {
		box-sizing: border-box;
		padding: 0.4rem 1.5rem 1.5rem;
		color: rgba(255, 255, 255, 0.95);
		/* Ancho común de los bloques apilados (partidos, tabla de grupo, terceros) para que se
		   alineen y se vea parejo. Cada tabla de grupo usa este ancho; con 2 grupos van lado a lado. */
		--bloque: 40rem;
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 0.9rem;
		flex-wrap: wrap;
	}

	.head h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 800;
	}

	.aviso {
		font-size: 0.78rem;
		color: #fde68a;
		background: rgba(245, 158, 11, 0.14);
		border: 1px solid rgba(245, 158, 11, 0.4);
		border-radius: 8px;
		padding: 0.15rem 0.55rem;
	}

	/* Etiqueta de fuente por fila: de dónde sale ESE marcador (monitor o manual). */
	.src {
		flex-shrink: 0;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #6ee7b7;
		background: rgba(16, 185, 129, 0.16);
		border: 1px solid rgba(16, 185, 129, 0.4);
		border-radius: 999px;
		padding: 0.08rem 0.45rem;
	}

	.src.manual {
		color: #fcd34d;
		background: rgba(245, 158, 11, 0.16);
		border-color: rgba(245, 158, 11, 0.4);
	}

	.sub {
		margin: 0.3rem 0 1.2rem;
		font-size: 0.88rem;
		color: rgba(255, 255, 255, 0.65);
	}

	.lista {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		max-width: var(--bloque);
	}

	.vrow {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.75rem 1.1rem;
		background: rgba(245, 158, 11, 0.1);
		border: 1px solid rgba(245, 158, 11, 0.45);
		border-radius: 12px;
		animation: glow 1.9s ease-in-out infinite;
	}

	@keyframes glow {
		0%,
		100% {
			box-shadow: 0 0 6px rgba(245, 158, 11, 0.2);
		}
		50% {
			box-shadow: 0 0 16px rgba(245, 158, 11, 0.45);
		}
	}

	/* El monitor se apagó (desconectado) o el partido terminó (finalizado): marcador conservado,
	   atenuado y sin pulso. */
	.vrow.desconectado,
	.vrow.terminado {
		background: rgba(255, 255, 255, 0.03);
		border-color: rgba(255, 255, 255, 0.14);
		animation: none;
		opacity: 0.72;
	}

	.chip {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: #fcd34d;
		white-space: nowrap;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #f59e0b;
		animation: halo 1.6s ease-out infinite;
	}

	@keyframes halo {
		0% {
			box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6);
		}
		70% {
			box-shadow: 0 0 0 7px rgba(245, 158, 11, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
		}
	}

	/* Chip atenuado para el estado desconectado. */
	.chip.off {
		color: #9ca3af;
	}

	.dot.off {
		background: #9ca3af;
		animation: none;
	}

	/* Chip para partido finalizado (terminó; lo dejamos 30 min). */
	.chip.fin {
		color: #7dd3fc;
	}

	.dot.fin {
		background: #7dd3fc;
		animation: none;
	}

	.vnum {
		flex-shrink: 0;
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.team {
		flex: 1;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 700;
		min-width: 0;
	}

	.team.a {
		justify-content: flex-end;
	}

	.team.b {
		justify-content: flex-start;
	}

	.nm {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.marc {
		flex-shrink: 0;
		padding: 0.15rem 0.8rem;
		background: rgba(0, 0, 0, 0.25);
		border-radius: 9px;
		font-size: 1.3rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: #fff;
	}

	.vacio {
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.6);
	}

	/* ── Próximos partidos (cuando no hay nada en vivo): mismo formato, en tono neutro ── */
	.prox-titulo {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 0.2rem 0 0.9rem;
		font-size: 1.05rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.9);
	}

	/* Fila de "próximo": misma estructura que la de en vivo, pero sin el resplandor ni el pulso. */
	.vrow.proximo {
		background: rgba(255, 255, 255, 0.03);
		border-color: rgba(255, 255, 255, 0.14);
		animation: none;
	}

	.chip.prox {
		color: rgba(255, 255, 255, 0.62);
	}

	.dot.prox {
		background: rgba(255, 255, 255, 0.5);
		animation: none;
	}

	/* "vs" en lugar del marcador, más discreto que un resultado real. */
	.marc.vs {
		font-size: 0.95rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.55);
		background: rgba(0, 0, 0, 0.18);
	}

	/* Tablas de los grupos en juego, debajo de los partidos. */
	.lado-grupos {
		min-width: 0;
	}

	.g-titulo {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 2rem 0 0.9rem;
		font-size: 1.05rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.9);
	}

	.g-nota {
		font-size: 0.72rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.5);
	}

	/* Tablas de los grupos en juego: lado a lado en desktop (hasta 2 por fila), apiladas en móvil.
	   --cols = nº de grupos involucrados (tope 2); cada tabla se topa en 30rem y encoge si hace falta. */
	.grid {
		display: grid;
		grid-template-columns: repeat(var(--cols, 1), minmax(0, 1fr));
		gap: 1rem;
		align-items: start;
		/* Cada tabla al ancho común; con 2 grupos, dos de ese ancho lado a lado (+ el gap). */
		max-width: calc(var(--cols, 1) * var(--bloque) + (var(--cols, 1) - 1) * 1rem);
	}

	@media (max-width: 640px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

</style>
