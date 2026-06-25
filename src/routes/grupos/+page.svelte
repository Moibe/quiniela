<script lang="ts">
	import TablaGrupo from '$lib/TablaGrupo.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<section class="grupos">
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

	.head h1 {
		margin: 0 0 0.35rem;
		font-size: 1.5rem;
		font-weight: 800;
	}

	.sub {
		margin: 0 0 0.35rem;
		font-size: 0.85rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.7);
	}

	.leyenda {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0 0 1rem;
		font-size: 0.72rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.55);
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
