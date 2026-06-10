<script lang="ts">
	import Bandera from '$lib/Bandera.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<section class="participantes">
	<div class="head">
		<p class="sub">
			Pronósticos de los {data.participantes.length} participantes · {data.rows.length} partidos de fase
			de grupos
		</p>
		<div class="leyenda" aria-hidden="true">
			<span class="leg"><span class="sw sw-res"></span> Acertó resultado · 1 pt</span>
			<span class="leg"><span class="sw sw-exa"></span> Marcador exacto · 3 pts</span>
		</div>
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
						<th scope="col" class="col-p">{nombre}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each data.rows as r (r.numero)}
					<tr class:jugado={r.jugado}>
						<th
							scope="row"
							class="col-num"
							title={r.jugado ? `Resultado real: ${r.real}` : undefined}>{r.numero}</th
						>
						<td class="col-team col-a">
							<div class="ti ti-a">
								<span class="tname" title={r.equipoA}>{r.equipoA}</span>
								<Bandera equipo={r.equipoA} />
							</div>
						</td>
						<td class="col-team col-b">
							<div class="ti ti-b">
								<Bandera equipo={r.equipoB} />
								<span class="tname" title={r.equipoB}>{r.equipoB}</span>
							</div>
						</td>
						{#each r.pronos as cell, i (i)}
							<td
								class="prono"
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
		padding: 0.85rem 1.25rem 1rem;
		color: rgba(255, 255, 255, 0.95);
		/* Anchos border-box (incluyen padding) para que el offset de las
		   columnas pegadas sea exacto y no se traslapen. */
		--w-num: 3rem;
		--w-team: 7.5rem;
	}

	.head {
		flex-shrink: 0;
	}

	.sub {
		margin: 0 0 0.4rem;
		font-size: 0.85rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.7);
	}

	/* Leyenda de colores: explica el guinda que ilumina la cuadrícula. */
	.leyenda {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.1rem;
		margin: 0 0 0.75rem;
		font-size: 0.72rem;
		color: rgba(255, 255, 255, 0.62);
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
		background: rgba(159, 18, 57, 0.4);
		border: 1px solid rgba(190, 18, 60, 0.5);
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
	tbody tr .prono.hit-resultado {
		background: rgba(159, 18, 57, 0.4);
		color: #ffe4ec;
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
