<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import Bandera from '$lib/Bandera.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let enCurso = $state(untrack(() => data.enCurso));
	let fuente = $state(untrack(() => data.fuente));
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
			fuente = d.fuente;
			conexion = true;
		} catch {
			conexion = false;
		}
	}

	onMount(() => {
		const id = setInterval(refrescar, 10000); // se actualiza solo
		return () => clearInterval(id);
	});
</script>

<section class="envivo">
	<div class="head">
		<h1>En Vivo</h1>
		{#if enCurso.length}
			<span class="fuente" class:manual={fuente === 'manual'}>
				{fuente === 'monitor' ? 'monitor en vivo' : 'captura manual'}
			</span>
		{/if}
		{#if !conexion}
			<span class="aviso">Sin conexión — datos quizá no actuales.</span>
		{/if}
	</div>
	<p class="sub">Marcadores de los partidos que se están jugando ahora mismo.</p>

	{#if enCurso.length}
		<ul class="lista">
			{#each enCurso as m (m.numero)}
				<li class="vrow">
					<span class="chip"><span class="dot" aria-hidden="true"></span> en vivo</span>
					<span class="vnum">#{m.numero}</span>
					<span class="team a">
						<span class="nm" translate="no">{m.equipoA}</span>
						<Bandera equipo={m.equipoA} />
					</span>
					<span class="marc">{m.golesA ?? '–'} : {m.golesB ?? '–'}</span>
					<span class="team b">
						<Bandera equipo={m.equipoB} />
						<span class="nm" translate="no">{m.equipoB}</span>
					</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="vacio">No hay partidos en curso ahora mismo.</p>
	{/if}
</section>

<style>
	.envivo {
		box-sizing: border-box;
		padding: 0.4rem 1.5rem 1.5rem;
		color: rgba(255, 255, 255, 0.95);
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

	/* Chip de fuente: de dónde sale el marcador en este momento. */
	.fuente {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: #6ee7b7;
		background: rgba(16, 185, 129, 0.14);
		border: 1px solid rgba(16, 185, 129, 0.4);
		border-radius: 999px;
		padding: 0.15rem 0.6rem;
	}

	.fuente.manual {
		color: #fde68a;
		background: rgba(245, 158, 11, 0.14);
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
		max-width: 44rem;
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
</style>
