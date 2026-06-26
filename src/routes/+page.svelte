<script lang="ts">
	import Bandera from '$lib/Bandera.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Partidos en curso → banner arriba de la tabla (no reordena las filas).
	const enCursoMatches = $derived(data.rows.filter((r) => r.enCurso));

	// Interacción de columnas (clic en el nombre del participante):
	//  • 1 clic     → resalta / quita el resalte de la columna (color, no se mueve).
	//  • doble clic → fija / suelta la columna (sticky) para recorrer las demás.
	// Un temporizador corto distingue el clic simple del doble.
	// VARIAS columnas resaltadas a la vez (toggle por clic). El "fijar" (doble clic) sigue siendo de
	// UNA sola columna: la pega a la izquierda para comparar mientras recorres las demás, y dos pegadas
	// al mismo borde se encimarían (cada una necesitaría su propio offset).
	let highlighted = $state<Set<number>>(new Set());
	let pinned = $state<number | null>(null);
	let clickTimer: ReturnType<typeof setTimeout> | null = null;

	function onColClick(i: number) {
		if (clickTimer !== null) {
			// Es el segundo clic (lo atenderá el doble clic): cancelamos el simple.
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

	// Marcar/desmarcar VARIAS FILAS (partidos) con un clic en su identidad (# o equipos).
	let filaMarcada = $state<Set<number>>(new Set());
	function toggleFila(n: number) {
		const next = new Set(filaMarcada);
		if (next.has(n)) next.delete(n);
		else next.add(n);
		filaMarcada = next;
	}

	// Auto-enfoque al entrar: lleva a la vista la fila del partido actual/más reciente.
	// rAF: espera al layout tras la hidratación (el scroll vive en .table-wrap, no en la ventana).
	const scrollSiFoco = (node: HTMLElement, esFoco: boolean) => {
		if (esFoco)
			requestAnimationFrame(() =>
				node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
			);
	};
</script>

<section class="participantes">
	<div class="top">
	<div class="head">
		<p class="sub">
			Pronósticos de los {data.participantes.length} participantes · {data.rows.length} partidos de fase
			de grupos
		</p>
		<div class="leyenda" aria-hidden="true">
			<span class="leg"><span class="sw sw-res"></span> Acertó resultado · 1 pt</span>
			<span class="leg"><span class="sw sw-exa"></span> Marcador exacto · 3 pts</span>
		</div>
		<p class="hint">
			💡 Clic en participantes resalta sus columnas (varias a la vez; doble clic fija una) · clic en un partido (# o
			equipos) marca sus filas (varias a la vez).
		</p>
	</div>

	{#if enCursoMatches.length}
		<div class="vivo-card">
			<span class="bv-tag"><span class="bv-dot" aria-hidden="true"></span> Partido en Curso</span>
			{#each enCursoMatches as m (m.numero)}
				<span class="bv-match">
					<span class="bv-num">#{m.numero}</span>
					<span class="bv-team notranslate" translate="no">{m.equipoA}</span>
					<Bandera equipo={m.equipoA} />
					<span class="bv-score">{m.real?.replace('-', ' – ')}</span>
					<Bandera equipo={m.equipoB} />
					<span class="bv-team notranslate" translate="no">{m.equipoB}</span>
					{#if m.minuto}<span class="bv-min">{m.minuto}</span>{/if}
				</span>
			{/each}
		</div>
	{/if}

	</div>

	<div class="table-wrap">
		<table>
			<caption class="sr-only">
				Pronósticos de {data.participantes.length} participantes para {data.rows.length} partidos de fase
				de grupos. Filas: partidos. Columnas: participantes. Celdas: marcador pronosticado.
			</caption>
			<thead>
				<tr>
					<th scope="col" class="col-num">#</th>
					<th scope="col" class="col-team col-a">Equipo 1</th>
					<th scope="col" class="col-team col-b">Equipo 2</th>
					{#each data.participantes as nombre, i (i)}
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
				{#each data.rows as r (r.numero)}
					<tr
						class:jugado={r.jugado}
						class:encurso={r.enCurso}
						class:fila-marcada={filaMarcada.has(r.numero)}
						use:scrollSiFoco={r.numero === data.focoNumero}
					>
						<th
							scope="row"
							class="col-num fila-handle"
							title={r.enCurso
								? `En curso: ${r.real} · clic para marcar`
								: r.jugado
									? `Resultado real: ${r.real} · clic para marcar`
									: 'Clic para marcar este partido'}
							onclick={() => toggleFila(r.numero)}>{r.numero}</th
						>
						<td class="col-team col-a fila-handle" onclick={() => toggleFila(r.numero)}>
							<div class="ti ti-a">
								<span class="tname notranslate" translate="no" title={r.equipoA}>{r.equipoA}</span>
								<Bandera equipo={r.equipoA} />
							</div>
						</td>
						<td class="col-team col-b fila-handle" onclick={() => toggleFila(r.numero)}>
							<div class="ti ti-b">
								<Bandera equipo={r.equipoB} />
								<span class="tname notranslate" translate="no" title={r.equipoB}>{r.equipoB}</span>
							</div>
						</td>
						{#each r.pronos as cell, i (i)}
							<td
								class="prono"
								class:highlighted={highlighted.has(i)}
								class:pinned={pinned === i}
								class:hit-resultado={cell.hit === 1}
								class:hit-exacto={cell.hit === 2}>{cell.s}</td
							>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<style>
	.participantes {
		display: flex;
		flex-direction: column;
		height: 100%;
		box-sizing: border-box;
		padding: 0.25rem 1.25rem 1rem;
		color: rgba(255, 255, 255, 0.95);
		/* Anchos border-box (incluyen padding) para que el offset de las
		   columnas pegadas sea exacto y no se traslapen. */
		--w-num: 3rem;
		--w-team: 7.5rem;
	}

	/* Fila superior: textos (izquierda) + gráfica de pastel (esquina derecha).
	   Separada de la cuadrícula con aire + una línea divisoria. */
	.top {
		flex-shrink: 0;
		display: flex;
		align-items: stretch;
		gap: 1rem 1.25rem;
		flex-wrap: wrap;
		margin-bottom: 0.8rem;
		padding-bottom: 0.7rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
	}

	/* Tarjeta de "Partido en Curso": a la izquierda, mismo tamaño que el pastel. */
	.vivo-card {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: flex-start;
		gap: 0.5rem;
		min-width: 13rem;
		padding: 0.6rem 0.9rem;
		background: rgba(245, 158, 11, 0.13);
		border: 1px solid rgba(245, 158, 11, 0.55);
		border-radius: 10px;
		color: #fde68a;
		animation: glow-banner 1.9s ease-in-out infinite;
	}

	.head {
		flex: 1 1 18rem;
		min-width: 0;
	}

	.sub {
		margin: 0 0 0.4rem;
		font-size: 0.85rem;
		font-weight: 400;
		color: #fff;
	}

	/* Leyenda de colores: explica el guinda que ilumina la cuadrícula. */
	.leyenda {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.1rem;
		margin: 0 0 0.35rem;
		font-size: 0.72rem;
		color: #fff;
	}

	.hint {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 400;
		color: #fff;
	}

	/* Banner de partido(s) EN CURSO: arriba, AFUERA de la tabla. No reordena nada;
	   solo anuncia el/los partido(s) en vivo con su marcador provisional. */

	@keyframes glow-banner {
		0%,
		100% {
			box-shadow: 0 0 6px rgba(245, 158, 11, 0.22);
		}
		50% {
			box-shadow: 0 0 15px rgba(245, 158, 11, 0.5);
		}
	}

	.bv-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: #fcd34d;
		white-space: nowrap;
	}

	.bv-dot {
		width: 9px;
		height: 9px;
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

	.bv-match {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.9rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.bv-num {
		font-size: 0.72rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.55);
	}

	.bv-score {
		padding: 0.05rem 0.55rem;
		background: rgba(0, 0, 0, 0.22);
		border-radius: 6px;
		font-variant-numeric: tabular-nums;
		color: #fff;
	}

	.bv-min {
		font-size: 0.78rem;
		font-weight: 700;
		color: #fcd34d;
		font-variant-numeric: tabular-nums;
	}

	.leg {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
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
		flex: 1;
		min-height: 0;
		overflow: auto;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		/* Aísla los repaints del scroll del backdrop-filter del panel. */
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

	/* Columnas de identidad del partido: pegadas a la izquierda. */
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

	/* Bandera + nombre dentro de la celda del equipo. */
	.ti {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		overflow: hidden;
	}

	.ti-a {
		justify-content: flex-end; /* nombre + bandera, pegados a la derecha (al centro) */
	}

	.ti-b {
		justify-content: flex-start; /* bandera + nombre, pegados a la izquierda (al centro) */
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

	/* --- Iluminado en guinda según el acierto ---
	   Van DESPUÉS del striping y del hover para ganar la cascada (misma
	   especificidad → gana el último): así una celda acertada conserva su
	   guinda aunque la fila esté en hover o sea fila par. */
	/* Acertó resultado (1 pt): rosa mexicano (un poco más claro). */
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

	/* Partido ya jugado: barra guinda al inicio de la fila (en la columna #),
	   para distinguir "ya hay resultado" de "aún no se juega". */
	tbody tr.jugado .col-num {
		box-shadow: inset 3px 0 0 rgba(190, 18, 60, 0.85);
		color: rgba(255, 255, 255, 0.82);
	}

	/* Partido EN CURSO: la celda # parpadea como un cuadro azul claro (en vivo).
	   El overlay va por box-shadow (la base #0a2a19 sigue opaca → la columna fija
	   no transparenta). La animación gana sobre la barra guinda de .jugado. */
	@keyframes vivo {
		0%,
		100% {
			box-shadow: inset 0 0 0 100px rgba(56, 189, 248, 0.1);
		}
		50% {
			box-shadow: inset 0 0 0 100px rgba(56, 189, 248, 0.62);
		}
	}

	tbody tr.encurso .col-num {
		color: #fff;
		animation: vivo 1.3s ease-in-out infinite;
	}

	/* En partido en curso, SOLO las casillas que están ganando puntos prenden y
	   apagan, cada una con su color oficial (rosa = resultado, guinda = exacto).
	   Las celdas sin acierto quedan quietas para no distraer. */
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

	tbody tr.encurso .prono.hit-resultado {
		animation: vivo-res 1.3s ease-in-out infinite;
	}

	tbody tr.encurso .prono.hit-exacto {
		animation: vivo-exa 1.3s ease-in-out infinite;
	}


	/* --- Columna fijada por doble clic (sticky-left junto a los equipos) ---
	   Se pega al borde izquierdo (tras #/Equipo1/Equipo2) con el MISMO offset que
	   usan esas columnas, así queda visible mientras recorres las demás. Lleva
	   bordes azules a los lados y fondo opaco para que no se transparente lo que
	   se desplaza por detrás. */
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

	/* Si la celda fijada además es acierto, conserva su color (rosa/guinda) pero
	   OPACO: capa de color sobre base oscura, para que tampoco se transparente. */
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

	/* --- Columna RESALTADA por 1 clic (spotlight): aclara la columna y le pone
	   bordes blancos. Va por box-shadow para sobrevivir hover/striping/aciertos y
	   combinarse con el pin. Si está fijada Y resaltada → bordes azules + aclarado. */
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

	/* --- Fila (partido) MARCADA por 1 clic en su identidad (# o equipos) ---
	   Igual que el resalte de columna pero horizontal: aclara la fila y le pone
	   bordes arriba/abajo. Va por box-shadow para sobrevivir hover/striping/aciertos. */
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

	/* En panel angosto (móvil) achica las columnas congeladas para que no se
	   coman toda la pantalla; el offset usa las mismas vars, así que sigue exacto. */
	@media (max-width: 600px) {
		.participantes {
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
