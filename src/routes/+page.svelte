<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<section class="participantes">
	<div class="head">
		<h1>Participantes</h1>
		<p class="sub">
			Pronósticos de los {data.participantes.length} participantes · {data.rows.length} partidos de fase
			de grupos
		</p>
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
					<tr>
						<th scope="row" class="col-num">{r.numero}</th>
						<td class="col-team col-a" title={r.equipoA}>{r.equipoA}</td>
						<td class="col-team col-b" title={r.equipoB}>{r.equipoB}</td>
						{#each r.pronos as s, i (i)}
							<td class="prono">{s}</td>
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
		padding: 1.25rem 1.25rem 1rem;
		color: rgba(255, 255, 255, 0.95);
		/* Anchos border-box (incluyen padding) para que el offset de las
		   columnas pegadas sea exacto y no se traslapen. */
		--w-num: 3rem;
		--w-team: 8rem;
	}

	.head {
		flex-shrink: 0;
	}

	h1 {
		margin: 0;
		font-size: 1.6rem;
		text-shadow:
			0 0 10px rgba(255, 255, 255, 0.28),
			0 0 24px rgba(255, 255, 255, 0.14);
	}

	.sub {
		margin: 0.3rem 0 1rem;
		font-size: 0.85rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.7);
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
		text-overflow: ellipsis;
		background: #0a2a19;
		font-weight: 400;
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

	/* En panel angosto (móvil) achica las columnas congeladas para que no se
	   coman toda la pantalla; el offset usa las mismas vars, así que sigue exacto. */
	@media (max-width: 600px) {
		.participantes {
			--w-team: 5rem;
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
