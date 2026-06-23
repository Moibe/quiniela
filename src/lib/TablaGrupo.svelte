<script lang="ts">
	import Bandera from '$lib/Bandera.svelte';
	import type { Grupo } from '$lib/grupos';

	// qlf: muestra "QLF" (calificado) en los 2 primeros. Se activa en En Vivo, donde la tabla sirve
	// para ver en tiempo real quién va clasificando.
	let { grupo, qlf = false }: { grupo: Grupo; qlf?: boolean } = $props();
</script>

<div class="grupo">
	<div class="g-head">
		<span class="g-label">Grupo {grupo.label}</span>
		<span class="g-prog">{grupo.partidosJugados}/6</span>
	</div>
	<div class="t-wrap">
		<table>
			<thead>
				<tr>
					<th class="c-pos">#</th>
					<th class="c-eq">Equipo</th>
					<th title="Partidos jugados">PJ</th>
					<th class="c-sec" title="Ganados">G</th>
					<th class="c-sec" title="Empatados">E</th>
					<th class="c-sec" title="Perdidos">P</th>
					<th class="c-sec" title="Goles a favor">GF</th>
					<th class="c-sec" title="Goles en contra">GC</th>
					<th title="Diferencia de goles">DG</th>
					<th class="c-pts">Pts</th>
				</tr>
			</thead>
			<tbody>
				{#each grupo.equipos as t (t.equipo)}
					<tr class:clasifica={t.pos <= 2} class:envivo={t.enVivo}>
						<td class="c-pos">{t.pos}</td>
						<th scope="row" class="c-eq">
							<Bandera equipo={t.equipo} />
							<span class="eq-name notranslate" translate="no" title={t.equipo}>{t.equipo}</span>
							{#if t.enVivo}<span class="vivo-dot" title="En vivo" aria-hidden="true"></span>{/if}
							{#if qlf && (t.pos <= 2 || t.terceroClasifica)}<span class="qlf" title="Calificado">QLF</span>{/if}
						</th>
						<td>{t.pj}</td>
						<td class="c-sec">{t.g}</td>
						<td class="c-sec">{t.e}</td>
						<td class="c-sec">{t.p}</td>
						<td class="c-sec">{t.gf}</td>
						<td class="c-sec">{t.gc}</td>
						<td class="dg">{t.dg > 0 ? '+' + t.dg : t.dg}</td>
						<td class="c-pts">{t.pts}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.grupo {
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 12px;
		overflow: hidden;
	}

	.g-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.55rem 0.85rem;
		background: #0a2a19;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.g-label {
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: 0.01em;
	}

	.g-prog {
		font-size: 0.72rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.5);
		font-variant-numeric: tabular-nums;
	}

	.t-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	th,
	td {
		padding: 0.42rem 0.4rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	thead th {
		font-size: 0.68rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.55);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	tbody tr {
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	tbody tr:last-child {
		border-bottom: 0;
	}

	.c-pos {
		width: 1.6rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.c-eq {
		text-align: left;
		font-weight: 400;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
		padding-left: 0.55rem;
	}

	.eq-name {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dg {
		color: rgba(255, 255, 255, 0.75);
	}

	.c-pts {
		font-weight: 700;
		color: #bbf7d0;
		font-size: 0.95rem;
	}

	/* Posiciones de clasificación (1-2): banda verde a la izquierda. */
	tbody tr.clasifica {
		background: rgba(34, 197, 94, 0.08);
	}

	tbody tr.clasifica .c-pos {
		box-shadow: inset 3px 0 0 #4ade80;
		color: #86efac;
		font-weight: 700;
	}

	/* "QLF" (calificado) en los 2 primeros: letras blancas con brillo. */
	.qlf {
		flex-shrink: 0;
		margin-left: auto;
		padding-left: 0.4rem;
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #fff;
		text-shadow:
			0 0 4px rgba(255, 255, 255, 0.95),
			0 0 11px rgba(255, 255, 255, 0.6),
			0 0 20px rgba(255, 255, 255, 0.35);
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

	/* Equipo jugando ahora: punto azul pulsante. */
	.vivo-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #38bdf8;
		flex-shrink: 0;
		animation: vivo-dot 1.3s ease-in-out infinite;
	}

	@keyframes vivo-dot {
		0%,
		100% {
			opacity: 1;
			box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.55);
		}
		50% {
			opacity: 0.35;
			box-shadow: 0 0 0 5px rgba(56, 189, 248, 0);
		}
	}

	/* En pantallas angostas se ocultan las columnas secundarias (G/E/P/GF/GC);
	   quedan #, Equipo, PJ, DG y Pts. */
	@media (max-width: 560px) {
		.c-sec {
			display: none;
		}
	}
</style>
