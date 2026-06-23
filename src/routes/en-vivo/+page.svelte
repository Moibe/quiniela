<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import Bandera from '$lib/Bandera.svelte';
	import TablaGrupo from '$lib/TablaGrupo.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let enCurso = $state(untrack(() => data.enCurso));
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
	<p class="sub">Marcadores de los partidos que se están jugando ahora mismo.</p>

	{#if enCurso.length}
		<ul class="lista">
			{#each enCurso as m (m.numero)}
				<li class="vrow" class:desconectado={m.estado === 'desconectado'} class:terminado={m.estado === 'terminado'}>
					{#if m.estado === 'vivo'}
						<span class="chip"><span class="dot" aria-hidden="true"></span> en vivo</span>
					{:else if m.estado === 'terminado'}
						<span class="chip fin"><span class="dot fin" aria-hidden="true"></span> finalizado · {hace(m.haceMs)}</span>
					{:else}
						<span class="chip off"><span class="dot off" aria-hidden="true"></span> desconectado · {hace(m.haceMs)}</span>
					{/if}
					<span class="src" class:manual={m.fuente === 'manual'}>{m.fuente}</span>
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

		{#if grupos.length}
			<h2 class="g-titulo">
				{grupos.length === 1 ? 'Tabla del grupo en juego' : 'Tablas de los grupos en juego'}
				<span class="g-nota">incluye el marcador en curso</span>
			</h2>
			<div class="grid" style="--cols:{Math.min(grupos.length, 2)}">
				{#each grupos as g (g.label)}
					<TablaGrupo grupo={g} qlf />
				{/each}
			</div>
		{/if}
	{:else}
		<p class="vacio">No hay partidos en curso ahora mismo.</p>
	{/if}

	{#if terceros.length}
		<details class="terceros">
			<summary class="t-head">
				<span class="chevron" aria-hidden="true">▸</span>
				<span class="t-titulo">Tabla de terceros lugares</span>
				<span class="t-nota">clasifican los 8 mejores</span>
			</summary>
			<div class="t-tabla">
				<table>
					<thead>
						<tr>
							<th class="c-pos">#</th>
							<th class="c-gr">Grupo</th>
							<th class="c-eq">Equipo</th>
							<th title="Partidos jugados">PJ</th>
							<th title="Diferencia de goles">DG</th>
							<th class="c-pts">Pts</th>
							<th class="c-qlf"></th>
						</tr>
					</thead>
					<tbody>
						{#each terceros as t, i (t.equipo)}
							<tr class:clasifica={t.clasifica} class:corte={i === 7}>
								<td class="c-pos">{i + 1}</td>
								<td class="c-gr">{t.grupo}</td>
								<th scope="row" class="c-eq">
									<Bandera equipo={t.equipo} />
									<span class="nm" translate="no">{t.equipo}</span>
								</th>
								<td>{t.pj}</td>
								<td>{t.dg > 0 ? '+' + t.dg : t.dg}</td>
								<td class="c-pts">{t.pts}</td>
								<td class="c-qlf">{#if t.clasifica}<span class="qlf" title="Calificado">QLF</span>{/if}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
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

	/* Tablas de los grupos en juego, debajo de los partidos. */
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
		grid-template-columns: repeat(var(--cols, 1), minmax(0, 30rem));
		gap: 1rem;
		align-items: start;
	}

	@media (max-width: 640px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	/* Lista replegable de los 12 terceros lugares (carrera por los 8 mejores). */
	.terceros {
		margin: 2rem 0 0;
		max-width: 40rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 12px;
		overflow: hidden;
	}

	.t-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.7rem 0.9rem;
		background: #0a2a19;
		cursor: pointer;
		list-style: none;
		user-select: none;
	}

	.t-head::-webkit-details-marker {
		display: none;
	}

	.chevron {
		color: rgba(255, 255, 255, 0.55);
		font-size: 0.8rem;
		transition: transform 0.18s ease;
	}

	.terceros[open] .chevron {
		transform: rotate(90deg);
	}

	.t-titulo {
		font-size: 0.95rem;
		font-weight: 700;
	}

	.t-nota {
		font-size: 0.72rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.5);
	}

	.t-tabla {
		overflow-x: auto;
	}

	.terceros table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.terceros th,
	.terceros td {
		padding: 0.42rem 0.5rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.terceros thead th {
		font-size: 0.68rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.55);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.terceros tbody tr {
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	.terceros tbody tr:last-child {
		border-bottom: 0;
	}

	.terceros .c-pos {
		width: 1.6rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.terceros .c-gr {
		color: rgba(255, 255, 255, 0.6);
		font-weight: 700;
	}

	.terceros .c-eq {
		text-align: left;
		font-weight: 400;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.terceros .c-pts {
		font-weight: 700;
		color: #bbf7d0;
	}

	.terceros .c-qlf {
		width: 2.6rem;
	}

	/* Los 8 que clasifican: banda verde; el 8º lleva la línea de corte. */
	.terceros tbody tr.clasifica {
		background: rgba(34, 197, 94, 0.08);
	}

	.terceros tbody tr.clasifica .c-pos {
		box-shadow: inset 3px 0 0 #4ade80;
		color: #86efac;
		font-weight: 700;
	}

	.terceros tbody tr.corte {
		border-bottom: 2px solid rgba(74, 222, 128, 0.55);
	}

	.terceros .qlf {
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #fff;
		text-shadow:
			0 0 4px rgba(255, 255, 255, 0.95),
			0 0 11px rgba(255, 255, 255, 0.6);
		animation: qlf-brillo 2.2s ease-in-out infinite;
	}

	@keyframes qlf-brillo {
		0%,
		100% {
			opacity: 0.82;
		}
		50% {
			opacity: 1;
		}
	}
</style>
