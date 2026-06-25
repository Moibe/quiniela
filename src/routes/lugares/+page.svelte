<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Medallas por NIVEL de podio (puntaje distinto), NO por rank: si el 2º lugar
	// está empatado, el 3er mejor puntaje sigue siendo "3er lugar" (bronce) aunque
	// su rank de competición sea 4. Los empatados comparten medalla.
	const top3 = $derived(
		[...new Set(data.standings.map((s) => s.puntos))]
			.filter((p) => p > 0)
			.sort((a, b) => b - a)
			.slice(0, 3)
	);
	const esPodio = (puntos: number) => puntos > 0 && top3.includes(puntos);
	const medalla = (puntos: number) => {
		const i = puntos > 0 ? top3.indexOf(puntos) : -1;
		return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
	};

	// Dos columnas: lugares 1→N/2 a la izquierda, el resto a la derecha (orden
	// continuo: se lee la columna izquierda completa y sigue arriba en la derecha).
	const mitad = $derived(Math.ceil(data.standings.length / 2));
	const izquierda = $derived(data.standings.slice(0, mitad));
	const derecha = $derived(data.standings.slice(mitad));

	// Quién SUBIÓ más lugares con el último resultado (mayor movimiento positivo). En empate gana el
	// mejor ubicado (standings ya viene por rank). null si nadie subió.
	const masSubio = $derived(
		[...data.standings].filter((s) => s.mov > 0).sort((a, b) => b.mov - a.mov)[0] ?? null
	);

	// Quién BAJÓ más lugares con el último resultado (movimiento más negativo). null si nadie bajó.
	const masBajo = $derived(
		[...data.standings].filter((s) => s.mov < 0).sort((a, b) => a.mov - b.mov)[0] ?? null
	);
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
					<tr class:podio={esPodio(s.puntos)}>
						<!-- Ranuras de ancho fijo: medalla | número | flecha, para que cada
						     elemento quede alineado en su propia columna fila a fila. -->
						<td class="col-pos"
							><span class="slot medal" aria-hidden="true">{medalla(s.puntos)}</span><span
								class="slot rank">{s.rank}</span
							><span class="slot mov-slot"
								>{#if s.mov}<span
										class="mov"
										class:up={s.mov > 0}
										class:down={s.mov < 0}
										title={s.mov > 0 ? `Subió ${s.mov} lugar(es)` : `Bajó ${-s.mov} lugar(es)`}
										>{s.mov > 0 ? '▲' : '▼'}{Math.abs(s.mov)}</span
									>{/if}</span
							></td
						>
						<th scope="row" class="col-name notranslate" translate="no">{s.nombre}</th>
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
		{#if masSubio}
			<p class="destacado">
				Con el último gol, <strong class="notranslate" translate="no">{masSubio.nombre}</strong> es el
				que más lugares ha subido: <span class="flecha-sube">▲{masSubio.mov}</span>
			</p>
		{/if}
		{#if masBajo}
			<p class="destacado bajo">
				Con el último gol, <strong class="notranslate" translate="no">{masBajo.nombre}</strong> es el
				que más lugares ha bajado: <span class="flecha-baja">▼{Math.abs(masBajo.mov)}</span>
			</p>
		{/if}
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
		margin: 0 0 0.45rem;
		font-size: 0.85rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.65);
	}

	/* Línea destacada (centrada, en un marco blanco brilloso): quién subió más lugares con el último
	   resultado. */
	.destacado {
		width: fit-content;
		max-width: 100%;
		box-sizing: border-box;
		margin: 0 auto 0.45rem;
		padding: 0.5rem 1.1rem;
		text-align: center;
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.9);
		border: 1.5px solid rgba(255, 255, 255, 0.85);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.04);
		/* Marco blanco brilloso ESTÁTICO (sin pulso continuo). */
		box-shadow:
			0 0 11px rgba(255, 255, 255, 0.4),
			inset 0 0 6px rgba(255, 255, 255, 0.05);
	}

	/* Variante en ROJO (el que más bajó): conserva el glow continuo pulsante + un poco más de aire
	   hacia la tabla. */
	.destacado.bajo {
		border-color: rgba(248, 113, 113, 0.85);
		margin-bottom: 1rem;
		animation: glow-rojo 2.1s ease-in-out infinite;
	}

	@keyframes glow-rojo {
		0%,
		100% {
			box-shadow:
				0 0 6px rgba(248, 113, 113, 0.3),
				inset 0 0 6px rgba(248, 113, 113, 0.05);
		}
		50% {
			box-shadow:
				0 0 18px rgba(248, 113, 113, 0.65),
				inset 0 0 9px rgba(248, 113, 113, 0.1);
		}
	}

	.destacado strong {
		color: #fff;
		font-weight: 700;
	}

	.flecha-sube {
		color: #4ade80;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}

	.flecha-baja {
		color: #f87171;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
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
		width: 5.5rem;
		color: rgba(255, 255, 255, 0.6);
		white-space: nowrap;
	}

	/* Ranuras de ancho fijo dentro de la celda #: medallas con medallas, números
	   con números y flechas con flechas, alineados verticalmente fila a fila. */
	.slot {
		display: inline-block;
	}

	.slot.medal {
		width: 1.3rem;
		text-align: right;
	}

	.slot.rank {
		width: 1.3rem;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.slot.mov-slot {
		width: 2rem;
		text-align: left;
		padding-left: 0.35rem;
		box-sizing: border-box;
	}

	/* Flechita de movimiento vs el ranking previo al último marcador. Prende y
	   apaga (misma lógica "en vivo" que la cuadrícula): late quien cambió con el
	   último cambio, cada flecha en su color oficial (▲ verde / ▼ rojo). */
	.mov {
		font-size: 0.68rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		animation: late 1.3s ease-in-out infinite;
	}

	@keyframes late {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.12;
		}
	}

	.mov.up {
		color: #4ade80;
	}

	.mov.down {
		color: #f87171;
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
