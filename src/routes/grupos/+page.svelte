<script lang="ts">
	import TablaGrupo from '$lib/TablaGrupo.svelte';
	import TablaTerceros from '$lib/TablaTerceros.svelte';
	import type { EquipoStanding } from '$lib/grupos';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Los 12 terceros lugares ordenados de mejor a peor (mismos criterios que el Mundial: pts, dif. de
	// goles, goles a favor); los 8 primeros clasifican (terceroClasifica, ya marcado por computeGrupos).
	const terceros = $derived(
		data.grupos
			.map((g) => ({ grupo: g.label, s: g.equipos[2] }))
			.filter((x): x is { grupo: string; s: EquipoStanding } => !!x.s)
			.sort(
				(a, b) =>
					b.s.pts - a.s.pts ||
					b.s.dg - a.s.dg ||
					b.s.gf - a.s.gf ||
					a.s.equipo.localeCompare(b.s.equipo, 'es')
			)
			.map(({ grupo, s }) => ({
				grupo,
				equipo: s.equipo,
				pj: s.pj,
				dg: s.dg,
				pts: s.pts,
				clasifica: s.terceroClasifica,
				enVivo: s.enVivo
			}))
	);
</script>

<section class="grupos">
	<div class="head-row">
		<div class="head">
			<h1>Tabla de Posiciones en Tiempo Real</h1>
			<p class="sub">
				Tablas de los 12 grupos del Mundial · <strong>{data.jugados}</strong> de {data.total} partidos
				jugados
			</p>
			<p class="leyenda" aria-hidden="true">
				<span class="chip-clasif"></span> Los 2 primeros de cada grupo avanzan ·
				<b class="qlf-leg">QLF*</b> = mejor tercero (clasificación provisional)
			</p>
		</div>

		<TablaTerceros {terceros} />
	</div>

	<div class="grid">
		{#each data.grupos as g (g.label)}
			<TablaGrupo grupo={g} qlf />
		{/each}
	</div>
</section>

<style>
	.grupos {
		box-sizing: border-box;
		padding: 0.4rem 1.5rem 1.5rem;
		color: rgba(255, 255, 255, 0.95);
	}

	/* El título y la tabla de terceros conviven en una fila: título a la izquierda, terceros a su
	   lado (derecha). En angosto, hace wrap y la tabla baja debajo del título. */
	.head-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem 2.5rem;
		margin-bottom: 1.1rem;
	}

	.head {
		flex: 1 1 22rem;
		min-width: 0;
	}

	.head h1 {
		margin: 0 0 0.35rem;
		font-size: 1.5rem;
		font-weight: 800;
	}

	.sub {
		margin: 0 0 0.35rem;
		font-size: 0.85rem;
		font-weight: 400;
		color: #fff;
	}

	.leyenda {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0;
		font-size: 0.72rem;
		font-weight: 400;
		color: #fff;
	}

	.chip-clasif {
		width: 0.9rem;
		height: 0.9rem;
		border-radius: 3px;
		background: rgba(34, 197, 94, 0.18);
		box-shadow: inset 3px 0 0 #4ade80;
	}

	.qlf-leg {
		color: rgba(255, 255, 255, 0.82);
		letter-spacing: 0.04em;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(26rem, 1fr));
		gap: 1rem;
		align-items: start;
	}

	@media (max-width: 560px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
