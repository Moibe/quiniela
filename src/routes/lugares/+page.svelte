<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const medalla = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '');

	// Dos columnas: lugares 1→N/2 a la izquierda, el resto a la derecha (orden
	// continuo: se lee la columna izquierda completa y sigue arriba en la derecha).
	const mitad = $derived(Math.ceil(data.standings.length / 2));
	const izquierda = $derived(data.standings.slice(0, mitad));
	const derecha = $derived(data.standings.slice(mitad));
</script>

{#snippet tabla(filas: typeof data.standings, lado: string)}
	<div class="table-wrap">
		<table>
			<caption class="sr-only">Posiciones ({lado}), ordenadas por puntos.</caption>
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
				{#each filas as s (s.participanteId)}
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
{/snippet}

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
			marcadores reales en <a href="/partidos">Partidos</a>.
		</p>
	{/if}

	<!-- Pantallas anchas: dos columnas (lugares 1→16 / 17→31). -->
	<div class="cols-desktop">
		{@render tabla(izquierda, 'columna izquierda')}
		{@render tabla(derecha, 'columna derecha')}
	</div>
	<!-- Móvil / pantallas angostas: una sola tabla continua con todos. -->
	<div class="cols-mobile">
		{@render tabla(data.standings, 'tabla completa')}
	</div>
</section>

<style>
	.posiciones {
		box-sizing: border-box;
		padding: 0.85rem 1.5rem 1rem;
		color: rgba(255, 255, 255, 0.95);
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

	/* Pantallas anchas: dos columnas centradas, lado a lado (sin envolver, para
	   no quedar como dos secciones apiladas). */
	.cols-desktop {
		display: flex;
		flex-wrap: nowrap;
		justify-content: center;
		gap: 1.25rem;
		align-items: flex-start;
	}

	/* Móvil / angosto: una sola tabla continua con los 31, a todo el ancho. */
	.cols-mobile {
		display: none;
	}

	.cols-mobile .table-wrap {
		max-width: none;
	}

	/* Bajo ~960px se cambia a una sola tabla (en vez de dos columnas apiladas). */
	@media (max-width: 60rem) {
		.cols-desktop {
			display: none;
		}
		.cols-mobile {
			display: block;
		}
	}

	.table-wrap {
		flex: 1 1 28rem;
		min-width: 0;
		max-width: 34rem;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
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

	/* Columna Pts resaltada: es la que define el lugar (la "buena").
	   Banda vertical con bordes verdes a los lados. El tinte de fondo va por
	   box-shadow inset (no por background) para que NO lo pisen el hover ni el
	   fondo de las filas de podio. */
	thead th.col-pts {
		color: #bbf7d0;
		background: #0c3d24;
		box-shadow:
			inset 2px 0 0 rgba(134, 239, 172, 0.55),
			inset -2px 0 0 rgba(134, 239, 172, 0.55);
	}

	tbody td.col-pts {
		color: #bbf7d0;
		box-shadow:
			inset 2px 0 0 rgba(134, 239, 172, 0.45),
			inset -2px 0 0 rgba(134, 239, 172, 0.45),
			inset 0 0 0 100px rgba(34, 197, 94, 0.12);
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
