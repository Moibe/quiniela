<script lang="ts">
	import { onMount } from 'svelte';
	import Bandera from '$lib/Bandera.svelte';
	import { q2Participantes, q2Juegos, type Q2Juego } from '$lib/q2Data';
	import { puntosDe, PUNTOS_EXACTO, PUNTOS_RESULTADO } from '$lib/scoring';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Resultado EN VIVO de cada juego (del monitor/sandbox), por etiqueta (J1…J5). Se refresca cada 10s
	// para que los aciertos (rosa = resultado, guinda = marcador exacto) se prendan/actualicen en vivo.
	// El load solo siembra el primer pintado; a partir de ahí manda el poll, por eso capturamos el valor inicial.
	// svelte-ignore state_referenced_locally
	let resultados = $state(data.resultados ?? []);
	const resPorJuego = $derived(
		new Map(resultados.map((r) => [r.etiqueta, r] as const))
	);

	onMount(() => {
		const id = setInterval(async () => {
			if (document.visibilityState !== 'visible') return;
			try {
				const res = await fetch('/api/q2');
				if (res.ok) resultados = (await res.json()).resultados ?? [];
			} catch {
				/* sin conexión: se mantiene lo último */
			}
		}, 10_000);
		return () => clearInterval(id);
	});

	// Acierto de una celda contra el resultado en vivo del juego: 2 = marcador exacto (guinda),
	// 1 = resultado correcto (rosa), 0 = nada / sin resultado aún. Misma lógica que Participantes.
	function hitDe(p: Q2Juego['pronos'][number], etiqueta: string): 0 | 1 | 2 {
		const r = resPorJuego.get(etiqueta);
		if (!r || r.golesA == null || r.golesB == null || p[0] == null || p[1] == null) return 0;
		const pts = puntosDe({ golesA: p[0], golesB: p[1] }, { golesA: r.golesA, golesB: r.golesB });
		return pts === PUNTOS_EXACTO ? 2 : pts === PUNTOS_RESULTADO ? 1 : 0;
	}

	const enVivoJuego = (etiqueta: string) => resPorJuego.get(etiqueta)?.estado === 'vivo';

	// Mismas interacciones que Participantes: VARIAS columnas resaltadas (1 clic), UNA fijada (doble
	// clic), VARIAS filas marcadas (clic en la identidad del juego).
	let highlighted = $state<Set<number>>(new Set());
	let pinned = $state<number | null>(null);
	let clickTimer: ReturnType<typeof setTimeout> | null = null;

	function onColClick(i: number) {
		if (clickTimer !== null) {
			clearTimeout(clickTimer);
			clickTimer = null;
			return;
		}
		clickTimer = setTimeout(() => {
			clickTimer = null;
			const next = new Set(highlighted);
			if (next.has(i)) next.delete(i);
			else next.add(i);
			highlighted = next;
		}, 250);
	}

	function onColDblClick(i: number) {
		if (clickTimer !== null) {
			clearTimeout(clickTimer);
			clickTimer = null;
		}
		pinned = pinned === i ? null : i;
	}

	let filaMarcada = $state<Set<number>>(new Set());
	function toggleFila(n: number) {
		const next = new Set(filaMarcada);
		if (next.has(n)) next.delete(n);
		else next.add(n);
		filaMarcada = next;
	}

	const marcador = (p: Q2Juego['pronos'][number]) =>
		p[0] == null || p[1] == null ? '' : `${p[0]}-${p[1]}`;
</script>

<section class="q2">
	<div class="top">
		<div class="head">
			<p class="sub">
				Quiniela 2 · Pronósticos de los {q2Participantes.length} participantes · {q2Juegos.length} juegos
			</p>
			<p class="hint">
				💡 Clic en participantes resalta sus columnas (varias a la vez; doble clic fija una) · clic en
				un juego (# o equipos) marca sus filas (varias a la vez).
			</p>
			<div class="leyenda" aria-hidden="true">
				<span class="leg"><span class="sw sw-res"></span> Resultado correcto</span>
				<span class="leg"><span class="sw sw-exa"></span> Marcador exacto</span>
				<span class="leg nota">se prenden con el resultado EN VIVO del monitor</span>
			</div>
		</div>
	</div>

	<div class="table-wrap">
		<table>
			<caption class="sr-only">
				Pronósticos de {q2Participantes.length} participantes para {q2Juegos.length} juegos de la Quiniela
				2. Filas: juegos. Columnas: participantes. Celdas: marcador pronosticado.
			</caption>
			<thead>
				<tr>
					<th scope="col" class="col-num">#</th>
					<th scope="col" class="col-team col-a">Equipo 1</th>
					<th scope="col" class="col-team col-b">Equipo 2</th>
					{#each q2Participantes as nombre, i (i)}
						<th
							scope="col"
							class="col-p notranslate"
							translate="no"
							class:highlighted={highlighted.has(i)}
							class:pinned={pinned === i}
							title="1 clic resalta · doble clic fija/suelta"
							onclick={() => onColClick(i)}
							ondblclick={() => onColDblClick(i)}
							>{#if pinned === i}<span class="pin" aria-hidden="true">📌</span>{/if}{nombre}</th
						>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each q2Juegos as j, ri (ri)}
					<tr class:fila-marcada={filaMarcada.has(ri)} class:envivo={enVivoJuego(j.etiqueta)}>
						<th
							scope="row"
							class="col-num fila-handle"
							title="Clic para marcar este juego"
							onclick={() => toggleFila(ri)}>{j.etiqueta}</th
						>
						<td class="col-team col-a fila-handle" onclick={() => toggleFila(ri)}>
							<div class="ti ti-a">
								<span class="tname notranslate" translate="no" title={j.equipoA}>{j.equipoA}</span>
								<Bandera equipo={j.equipoA} />
							</div>
						</td>
						<td class="col-team col-b fila-handle" onclick={() => toggleFila(ri)}>
							<div class="ti ti-b">
								<Bandera equipo={j.equipoB} />
								<span class="tname notranslate" translate="no" title={j.equipoB}>{j.equipoB}</span>
							</div>
						</td>
						{#each j.pronos as p, i (i)}
							{@const h = hitDe(p, j.etiqueta)}
							<td
								class="prono"
								class:highlighted={highlighted.has(i)}
								class:pinned={pinned === i}
								class:hit-resultado={h === 1}
								class:hit-exacto={h === 2}>{marcador(p)}</td
							>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<style>
	.q2 {
		box-sizing: border-box;
		padding: 0.4rem 1.25rem 1rem;
		color: rgba(255, 255, 255, 0.95);
		/* Anchos border-box (incluyen padding) para que el offset de las columnas pegadas sea exacto. */
		--w-num: 3rem;
		--w-team: 7.5rem;
	}

	.top {
		margin-bottom: 0.8rem;
		padding-bottom: 0.7rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
	}

	.sub {
		margin: 0 0 0.4rem;
		font-size: 0.85rem;
		font-weight: 400;
		color: #fff;
	}

	.hint {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 400;
		color: #fff;
	}

	/* Leyenda de colores: rosa = resultado, guinda = marcador exacto. */
	.leyenda {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 1.1rem;
		margin: 0.35rem 0 0;
		font-size: 0.72rem;
		color: #fff;
	}

	.leg {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.leg.nota {
		color: rgba(255, 255, 255, 0.6);
	}

	.sw {
		width: 1.5rem;
		height: 0.85rem;
		border-radius: 4px;
		flex-shrink: 0;
	}

	.sw-res {
		background: rgba(240, 76, 158, 0.55);
		border: 1px solid rgba(240, 76, 158, 0.8);
	}

	.sw-exa {
		background: rgba(190, 18, 60, 0.88);
		box-shadow:
			inset 0 0 0 1px rgba(253, 164, 175, 0.6),
			0 0 8px rgba(244, 63, 94, 0.55);
	}

	.table-wrap {
		overflow: auto;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		contain: paint;
	}

	table {
		border-collapse: separate;
		border-spacing: 0;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	th,
	td {
		box-sizing: border-box;
		padding: 0.4rem 0.55rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
		border-right: 1px solid rgba(255, 255, 255, 0.05);
		text-align: center;
	}

	/* Header de participantes: pegado arriba. */
	thead th {
		position: sticky;
		top: 0;
		z-index: 2;
		background: #0a2a19;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.9);
	}

	/* Columnas de identidad del juego: pegadas a la izquierda. */
	.col-num {
		position: sticky;
		left: 0;
		z-index: 1;
		width: var(--w-num);
		min-width: var(--w-num);
		background: #0a2a19;
		color: rgba(255, 255, 255, 0.62);
		font-size: 0.72rem;
		font-weight: 400;
	}

	.col-a {
		position: sticky;
		left: var(--w-num);
		z-index: 1;
		text-align: right;
	}

	.col-b {
		position: sticky;
		left: calc(var(--w-num) + var(--w-team));
		z-index: 1;
		text-align: left;
		border-right: 1px solid rgba(255, 255, 255, 0.18);
	}

	.col-team {
		width: var(--w-team);
		min-width: var(--w-team);
		max-width: var(--w-team);
		overflow: hidden;
		background: #0a2a19;
		font-weight: 400;
	}

	.ti {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		overflow: hidden;
	}

	.ti-a {
		justify-content: flex-end;
	}

	.ti-b {
		justify-content: flex-start;
	}

	.tname {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	/* Esquinas (header + columna pegada): por encima de ambos. */
	thead .col-num,
	thead .col-a,
	thead .col-b {
		z-index: 3;
	}

	.col-p {
		min-width: 2.9rem;
		color: rgba(255, 255, 255, 0.9);
		cursor: pointer;
		user-select: none;
	}

	.prono {
		color: rgba(255, 255, 255, 0.82);
		font-variant-numeric: tabular-nums;
	}

	tbody tr:nth-child(even) .prono {
		background: rgba(255, 255, 255, 0.025);
	}

	tbody tr:hover .prono {
		background: rgba(34, 197, 94, 0.1);
	}

	tbody tr:hover .col-num,
	tbody tr:hover .col-team {
		background: #0f3a23;
	}

	/* --- Aciertos: se prenden con el resultado EN VIVO del monitor ---
	   rosa = resultado correcto, guinda = marcador exacto. Van DESPUÉS del
	   striping/hover para ganar el cascade (misma especificidad → gana el último). */
	tbody tr .prono.hit-resultado {
		background: rgba(240, 76, 158, 0.45);
		color: #fff;
		font-weight: 600;
		transition: background 0.25s ease;
	}

	tbody tr .prono.hit-exacto {
		background: rgba(190, 18, 60, 0.88);
		color: #fff;
		font-weight: 700;
		box-shadow:
			inset 0 0 0 1px rgba(253, 164, 175, 0.55),
			0 0 10px rgba(244, 63, 94, 0.45);
		text-shadow: 0 0 8px rgba(253, 164, 175, 0.5);
		transition: background 0.25s ease;
	}

	/* Juego EN VIVO: solo las casillas que están ganando puntos laten. */
	@keyframes vivo-res {
		0%,
		100% {
			background-color: rgba(240, 76, 158, 0.45);
		}
		50% {
			background-color: rgba(240, 76, 158, 0.08);
		}
	}

	@keyframes vivo-exa {
		0%,
		100% {
			background-color: rgba(190, 18, 60, 0.88);
		}
		50% {
			background-color: rgba(190, 18, 60, 0.15);
		}
	}

	tbody tr.envivo .prono.hit-resultado {
		animation: vivo-res 1.3s ease-in-out infinite;
	}

	tbody tr.envivo .prono.hit-exacto {
		animation: vivo-exa 1.3s ease-in-out infinite;
	}

	/* --- Columna fijada por doble clic (sticky-left junto a los equipos) --- */
	.col-p.pinned {
		position: sticky;
		left: calc(var(--w-num) + 2 * var(--w-team));
		z-index: 3;
		box-shadow:
			inset 2px 0 0 rgba(96, 165, 250, 0.85),
			inset -2px 0 0 rgba(96, 165, 250, 0.65);
	}

	tbody tr td.prono.pinned {
		position: sticky;
		left: calc(var(--w-num) + 2 * var(--w-team));
		z-index: 1;
		background: #0a2a19;
		box-shadow:
			inset 2px 0 0 rgba(96, 165, 250, 0.75),
			inset -2px 0 0 rgba(96, 165, 250, 0.55);
	}

	/* Celda fijada que además es acierto: conserva su color pero OPACO (capa sobre
	   base oscura) para que no transparente lo que se desplaza por detrás. */
	tbody tr td.prono.pinned.hit-resultado {
		background: linear-gradient(rgba(240, 76, 158, 0.5), rgba(240, 76, 158, 0.5)), #0a2a19;
		color: #fff;
	}

	tbody tr td.prono.pinned.hit-exacto {
		background: linear-gradient(rgba(190, 18, 60, 0.92), rgba(190, 18, 60, 0.92)), #0a2a19;
		color: #fff;
	}

	.pin {
		margin-right: 0.2rem;
	}

	/* --- Columna RESALTADA por 1 clic (spotlight) --- */
	.col-p.highlighted {
		box-shadow:
			inset 2px 0 0 rgba(255, 255, 255, 0.6),
			inset -2px 0 0 rgba(255, 255, 255, 0.6),
			inset 0 0 0 100px rgba(255, 255, 255, 0.08);
	}

	tbody tr td.prono.highlighted {
		box-shadow:
			inset 2px 0 0 rgba(255, 255, 255, 0.55),
			inset -2px 0 0 rgba(255, 255, 255, 0.55),
			inset 0 0 0 100px rgba(255, 255, 255, 0.12);
	}

	.col-p.pinned.highlighted {
		box-shadow:
			inset 2px 0 0 rgba(96, 165, 250, 0.85),
			inset -2px 0 0 rgba(96, 165, 250, 0.65),
			inset 0 0 0 100px rgba(255, 255, 255, 0.08);
	}

	tbody tr td.prono.pinned.highlighted {
		box-shadow:
			inset 2px 0 0 rgba(96, 165, 250, 0.75),
			inset -2px 0 0 rgba(96, 165, 250, 0.55),
			inset 0 0 0 100px rgba(255, 255, 255, 0.12);
	}

	/* --- Fila (juego) MARCADA por 1 clic en su identidad --- */
	tbody .fila-handle {
		cursor: pointer;
		user-select: none;
	}

	tbody tr.fila-marcada th,
	tbody tr.fila-marcada td {
		box-shadow:
			inset 0 2px 0 rgba(255, 255, 255, 0.6),
			inset 0 -2px 0 rgba(255, 255, 255, 0.6),
			inset 0 0 0 100px rgba(255, 255, 255, 0.1);
	}

	@media (max-width: 600px) {
		.q2 {
			--w-team: 6.5rem;
		}
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}
</style>
