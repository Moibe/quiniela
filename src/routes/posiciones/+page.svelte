<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const medalla = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '');
</script>

<section class="posiciones">
	<div class="head">
		<p class="sub">
			3 pts por marcador exacto · 1 pt por resultado correcto ·
			<strong>{data.partidosJugados}</strong> de {data.totalPartidos} partidos con resultado
		</p>
	</div>

	{#if data.partidosJugados === 0}
		<p class="empty">
			Aún no hay resultados cargados. La tabla se irá llenando conforme el admin capture los
			marcadores reales en <a href="/resultados">Resultados</a>.
		</p>
	{/if}

	<div class="table-wrap">
		<table>
			<caption class="sr-only">Tabla de posiciones de la quiniela, ordenada por puntos.</caption>
			<thead>
				<tr>
					<th scope="col" class="col-pos">#</th>
					<th scope="col" class="col-name">Participante</th>
					<th scope="col" class="col-pts">Pts</th>
					<th scope="col" class="col-n" title="Marcadores exactos (3 pts c/u)">Exactos</th>
					<th scope="col" class="col-n" title="Resultados correctos (1 pt c/u)">Resultado</th>
				</tr>
			</thead>
			<tbody>
				{#each data.standings as s (s.participanteId)}
					<tr class:podio={s.rank <= 3 && s.puntos > 0}>
						<td class="col-pos">{medalla(s.rank)}{s.rank}</td>
						<th scope="row" class="col-name">{s.nombre}</th>
						<td class="col-pts">{s.puntos}</td>
						<td class="col-n">{s.exactos}</td>
						<td class="col-n">{s.resultados}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<style>
	.posiciones {
		display: flex;
		flex-direction: column;
		height: 100%;
		box-sizing: border-box;
		padding: 0.85rem 1.5rem 1rem;
		color: rgba(255, 255, 255, 0.95);
	}

	.head {
		flex-shrink: 0;
	}

	.sub {
		margin: 0 0 1rem;
		font-size: 0.85rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.65);
	}

	.empty {
		margin: 0 0 1rem;
		font-size: 0.9rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.7);
	}

	.empty a {
		color: #86efac;
	}

	.table-wrap {
		flex: 1;
		min-height: 0;
		overflow: auto;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		max-width: 40rem;
	}

	table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-size: 0.9rem;
	}

	th,
	td {
		box-sizing: border-box;
		padding: 0.55rem 0.8rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
		text-align: center;
		white-space: nowrap;
	}

	thead th {
		position: sticky;
		top: 0;
		z-index: 1;
		background: #0a2a19;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.9);
		font-size: 0.78rem;
	}

	.col-pos {
		width: 4rem;
		color: rgba(255, 255, 255, 0.6);
	}

	.col-name {
		text-align: left;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.95);
	}

	.col-pts {
		width: 4rem;
		font-size: 1.05rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.col-n {
		width: 6rem;
		color: rgba(255, 255, 255, 0.7);
		font-variant-numeric: tabular-nums;
	}

	tbody tr:hover td,
	tbody tr:hover .col-name {
		background: rgba(255, 255, 255, 0.05);
	}

	tbody tr.podio .col-pts {
		color: #86efac;
	}

	tbody tr.podio {
		background: rgba(34, 197, 94, 0.07);
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
