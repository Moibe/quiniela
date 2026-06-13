<script lang="ts">
	import { goto } from '$app/navigation';
	import Bandera from '$lib/Bandera.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function elegir(e: Event) {
		const id = (e.currentTarget as HTMLSelectElement).value;
		goto(`?p=${id}`, { keepFocus: true, noScroll: true });
	}
</script>

<section class="segunda">
	<div class="head">
		<div class="sel-row">
			<label class="sel-label" for="part">Segunda Ronda según los pronósticos de</label>
			<select id="part" class="sel" value={data.selectedId} onchange={elegir}>
				{#each data.participantes as p (p.id)}
					<option value={p.id}>{p.nombre}</option>
				{/each}
			</select>
		</div>
		<p class="sub">
			Dieciseisavos de final armados con la tabla que resultaría de los pronósticos de <strong
				>{data.selectedNombre}</strong
			> (1° y 2° de cada grupo + 8 mejores terceros), sin cruzar a equipos del mismo grupo. Es
			hipotético: refleja sus predicciones de grupos, no resultados reales.
		</p>
	</div>

	<div class="cruces">
		{#each data.cruces as c (c.llave)}
			<div class="cruce">
				<span class="llave">Llave {c.llave}</span>
				<div class="enfrent">
					<span class="lado a">
						<span class="org">{c.a.origen}</span>
						<span class="nm" title={c.a.equipo}>{c.a.equipo}</span>
						<Bandera equipo={c.a.equipo} />
					</span>
					<span class="vs">vs</span>
					<span class="lado b">
						<Bandera equipo={c.b.equipo} />
						<span class="nm" title={c.b.equipo}>{c.b.equipo}</span>
						<span class="org">{c.b.origen}</span>
					</span>
				</div>
			</div>
		{/each}
	</div>
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

	.cruces {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(25rem, 1fr));
		gap: 0.5rem 1rem;
		align-items: start;
	}

	.cruce {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.5rem 0.85rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
	}

	.llave {
		flex-shrink: 0;
		width: 3.6rem;
		font-size: 0.68rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.45);
		letter-spacing: 0.02em;
	}

	.enfrent {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
	}

	.lado {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.lado.a {
		justify-content: flex-end;
	}

	.lado.b {
		justify-content: flex-start;
	}

	.nm {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 700;
		font-size: 0.85rem;
	}

	.org {
		flex-shrink: 0;
		font-size: 0.62rem;
		font-weight: 700;
		color: #86efac;
		background: rgba(34, 197, 94, 0.14);
		border: 1px solid rgba(34, 197, 94, 0.35);
		border-radius: 5px;
		padding: 0.05rem 0.3rem;
		white-space: nowrap;
	}

	.vs {
		font-size: 0.68rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.4);
	}

	@media (max-width: 560px) {
		.cruces {
			grid-template-columns: 1fr;
		}
	}
</style>
