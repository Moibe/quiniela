<script lang="ts">
	import { goto } from '$app/navigation';
	import Bandera from '$lib/Bandera.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function elegir(e: Event) {
		const v = (e.currentTarget as HTMLSelectElement).value;
		goto(`?p=${v}`, { keepFocus: true, noScroll: true });
	}

	// Emparejado OFICIAL del cuadro FIFA 2026: qué dieciseisavos (73-88) se cruzan en octavos. Cada par
	// = un octavo. NO es consecutivo (73-74): el cuadro es fijo por estructura (octavo 90 = Ganador 73
	// vs Ganador 75, etc.). Mitad izquierda (pares 0-3) → una semifinal; mitad derecha (4-7) → la otra.
	const PARES_OFICIALES = [
		[73, 75], // R16 90  ┐ QF 97 ┐
		[74, 77], // R16 89  ┘       │ SF 101 (izquierda)
		[83, 84], // R16 93  ┐ QF 98 ┘
		[81, 82], // R16 94  ┘
		[76, 78], // R16 91  ┐ QF 99 ┐
		[79, 80], // R16 92  ┘       │ SF 102 (derecha)
		[86, 88], // R16 95  ┐ QF 100┘
		[85, 87] //  R16 96  ┘
	];
	const pares = $derived.by(() => {
		const byNum = new Map(data.cruces.map((c) => [c.numero, c]));
		const out: (typeof data.cruces)[] = [];
		for (const [n1, n2] of PARES_OFICIALES) {
			const a = byNum.get(n1);
			const b = byNum.get(n2);
			if (a && b) out.push([a, b]);
		}
		return out;
	});
</script>

<section class="segunda">
	<div class="head">
		<div class="sel-row">
			<label class="sel-label" for="part">
				{data.esReal
					? 'Segunda Ronda según los resultados reales hasta ahora'
					: 'Proyección de Posible 2da Ronda basado en los resultados de: '}
			</label>
			<select id="part" class="sel notranslate" value={data.selectedKey} onchange={elegir} translate="no">
				<option value="real">⚽ Real</option>
				{#each data.participantes as p (p.id)}
					<option value={String(p.id)}>{p.nombre}</option>
				{/each}
			</select>
		</div>
		{#if data.esReal}
			<p class="sub">
				Dieciseisavos de final (partidos 73–88) con el <strong>cuadro oficial fijo</strong> de la
				FIFA aplicado a la tabla <strong>real hasta ahora</strong> ({data.jugados} de {data.totalPartidos}
				partidos con resultado). Los terceros se ubican según la tabla oficial de 495 combinaciones
				(Annex C). Es <strong>provisional</strong>: cambia con cada partido; los equipos aún
				empatados (incluidos los que no han jugado) se ordenan por los criterios oficiales y, a falta
				de juego, por nombre.
			</p>
		{:else}
			<p class="sub">
				Dieciseisavos de final (partidos 73–88) con el <strong>cuadro oficial fijo</strong> de la
				FIFA aplicado a la tabla que resultaría de los pronósticos de
				<strong class="notranslate" translate="no">{data.selectedNombre}</strong> (1° y 2° de cada grupo + 8 mejores terceros). Los
				terceros se ubican según la tabla oficial de 495 combinaciones (Annex C). Es hipotético:
				refleja sus predicciones de grupos, no resultados reales.
			</p>
		{/if}
	</div>

	{#snippet matchBox(c: (typeof data.cruces)[number])}
		<div class="match">
			<span class="mnum">#{c.numero}</span>
			<span class="team">
				<Bandera equipo={c.a.equipo} />
				<span class="nm notranslate" translate="no" title={c.a.equipo}>{c.a.equipo}</span>
				<span class="org">{c.a.origen}</span>
			</span>
			<span class="team">
				<Bandera equipo={c.b.equipo} />
				<span class="nm notranslate" translate="no" title={c.b.equipo}>{c.b.equipo}</span>
				<span class="org">{c.b.origen}</span>
			</span>
		</div>
	{/snippet}

	{#if data.cruces.length}
		<div class="bracket">
			<div class="col izq">
				{#each pares.slice(0, 4) as par (par[0].numero)}
					<div class="par">
						{@render matchBox(par[0])}
						{@render matchBox(par[1])}
					</div>
				{/each}
			</div>
			<div class="centro" aria-hidden="true"><span class="trofeo">🏆</span></div>
			<div class="col der">
				{#each pares.slice(4, 8) as par (par[0].numero)}
					<div class="par">
						{@render matchBox(par[0])}
						{@render matchBox(par[1])}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</section>

<style>
	.segunda {
		box-sizing: border-box;
		padding: 0.4rem 1.5rem 1.5rem;
		color: rgba(255, 255, 255, 0.95);
	}

	.sel-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin: 0.2rem 0 0.5rem;
	}

	.sel-label {
		font-size: 0.95rem;
		font-weight: 700;
	}

	.sel {
		font: inherit;
		font-weight: 700;
		font-size: 0.95rem;
		color: #fff;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 8px;
		padding: 0.3rem 0.6rem;
		color-scheme: dark;
		cursor: pointer;
	}

	.sel:focus {
		outline: none;
		border-color: rgba(34, 197, 94, 0.6);
		box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25);
	}

	/* Sin esto, las opciones heredan el texto blanco del select sobre el fondo
	   blanco del menú nativo y se ven en blanco (invisibles). Fondo oscuro. */
	.sel option {
		background: #0a2a19;
		color: #fff;
	}

	.sub {
		margin: 0 0 1rem;
		font-size: 0.8rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.6);
		max-width: 60rem;
	}

	/* Bracket de dieciseisavos: dos mitades (8 llaves c/u) que pliegan hacia el centro. */
	.bracket {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.6rem;
		overflow-x: auto;
		padding-bottom: 0.5rem;
	}

	.col {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 1.7rem;
	}

	.par {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	/* Conector de bracket: une las 2 llaves del par y apunta hacia el centro. */
	.col.izq .par::after,
	.col.der .par::after {
		content: '';
		position: absolute;
		top: 25%;
		bottom: 25%;
		width: 0.7rem;
		border: 2px solid rgba(34, 197, 94, 0.45);
	}

	.col.izq .par::after {
		right: -0.85rem;
		border-left: 0;
		border-radius: 0 7px 7px 0;
	}

	.col.der .par::after {
		left: -0.85rem;
		border-right: 0;
		border-radius: 7px 0 0 7px;
	}

	.centro {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.9rem;
		filter: drop-shadow(0 0 8px rgba(250, 204, 21, 0.4));
	}

	.match {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		width: 13rem;
		padding: 0.4rem 0.6rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
	}

	.mnum {
		position: absolute;
		top: 0.25rem;
		right: 0.45rem;
		font-size: 0.56rem;
		color: rgba(255, 255, 255, 0.3);
	}

	.team {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.team .nm {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 700;
		font-size: 0.82rem;
	}

	.team .org {
		margin-left: auto;
		flex-shrink: 0;
		font-size: 0.56rem;
		font-weight: 700;
		color: #86efac;
		background: rgba(34, 197, 94, 0.14);
		border: 1px solid rgba(34, 197, 94, 0.35);
		border-radius: 5px;
		padding: 0.05rem 0.3rem;
		white-space: nowrap;
	}

	/* Mitad derecha: reflejada (bandera a la derecha, etiqueta hacia el centro). */
	.col.der .team {
		flex-direction: row-reverse;
	}

	.col.der .team .org {
		margin-left: 0;
		margin-right: auto;
	}

	.col.der .mnum {
		right: auto;
		left: 0.45rem;
	}

	/* Móvil/angosto: sin bracket; una sola columna de llaves. */
	@media (max-width: 820px) {
		.bracket {
			flex-direction: column;
			align-items: stretch;
		}
		.col {
			gap: 0.55rem;
		}
		.par::after,
		.centro {
			display: none;
		}
		.col.der .team {
			flex-direction: row;
		}
		.col.der .team .org {
			margin-left: auto;
			margin-right: 0;
		}
		.col.der .mnum {
			right: 0.45rem;
			left: auto;
		}
		.match {
			width: auto;
		}
	}
</style>
