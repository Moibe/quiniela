<script lang="ts">
	import Bandera from '$lib/Bandera.svelte';

	// Un tercero de la tabla "carrera por los 8 mejores". Misma forma en Grupos (derivado) y En Vivo
	// (TerceroEnVivo): grupo, equipo, pj, dg, pts y si está entre los 8 que clasifican.
	type Tercero = {
		grupo: string;
		equipo: string;
		pj: number;
		dg: number;
		pts: number;
		clasifica: boolean;
	};

	// open: arranca desplegada (por defecto NO — se muestra solo el encabezado replegable).
	let { terceros, open = false }: { terceros: Tercero[]; open?: boolean } = $props();
</script>

{#if terceros.length}
	<details class="terceros" {open}>
		<summary class="t-head">
			<span class="chevron" aria-hidden="true">▸</span>
			<span class="t-titulo">Tabla de terceros lugares</span>
			<span class="t-nota">clasifican los 8 mejores</span>
		</summary>
		<div class="t-tabla">
			<table>
				<thead>
					<tr>
						<th class="c-pos">#</th>
						<th class="c-gr">Grupo</th>
						<th class="c-eq">Equipo</th>
						<th title="Partidos jugados">PJ</th>
						<th title="Diferencia de goles">DG</th>
						<th class="c-pts">Pts</th>
						<th class="c-qlf"></th>
					</tr>
				</thead>
				<tbody>
					{#each terceros as t, i (t.equipo)}
						<tr class:clasifica={t.clasifica} class:primero={i === 0} class:corte={i === 7}>
							<td class="c-pos">{i + 1}</td>
							<td class="c-gr">{t.grupo}</td>
							<th scope="row" class="c-eq">
								<Bandera equipo={t.equipo} />
								<span class="nm" translate="no">{t.equipo}</span>
							</th>
							<td>{t.pj}</td>
							<td>{t.dg > 0 ? '+' + t.dg : t.dg}</td>
							<td class="c-pts">{t.pts}</td>
							<td class="c-qlf">{#if t.clasifica}<span class="qlf" title="Calificado">QLF</span>{/if}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
{/if}

<style>
	/* Tabla replegable de los 12 terceros lugares (carrera por los 8 mejores). Sirve como hijo flex
	   (Grupos, junto al título) o como bloque apilado (En Vivo): flex-basis para el primero, max-width
	   para el segundo. */
	.terceros {
		flex: 0 1 30rem;
		align-self: flex-start;
		max-width: 30rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 12px;
		overflow: hidden;
	}

	.t-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.7rem 0.9rem;
		background: #0a2a19;
		cursor: pointer;
		list-style: none;
		user-select: none;
	}

	.t-head::-webkit-details-marker {
		display: none;
	}

	.chevron {
		color: rgba(255, 255, 255, 0.55);
		font-size: 0.8rem;
		transition: transform 0.18s ease;
	}

	.terceros[open] .chevron {
		transform: rotate(90deg);
	}

	.t-titulo {
		font-size: 0.95rem;
		font-weight: 700;
	}

	.t-nota {
		font-size: 0.72rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.5);
	}

	.t-tabla {
		overflow-x: auto;
	}

	.terceros table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.terceros th,
	.terceros td {
		padding: 0.42rem 0.5rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.terceros thead th {
		font-size: 0.68rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.55);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.terceros tbody tr {
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	.terceros tbody tr:last-child {
		border-bottom: 0;
	}

	.terceros .c-pos {
		width: 1.6rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.terceros .c-gr {
		color: rgba(255, 255, 255, 0.6);
		font-weight: 700;
	}

	.terceros .c-eq {
		text-align: left;
		font-weight: 400;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.terceros .c-pts {
		font-weight: 700;
		color: #bbf7d0;
	}

	.terceros .c-qlf {
		width: 2.6rem;
	}

	/* Los 8 que clasifican: fondo verde tenue + un MARCO verde COMPLETO rodeando todo el bloque
	   (arriba, abajo y los dos lados), no solo la "L" de la izquierda + el corte. */
	.terceros tbody tr.clasifica {
		background: rgba(34, 197, 94, 0.08);
	}

	.terceros tbody tr.clasifica .c-pos {
		border-left: 2px solid #4ade80; /* lado izquierdo */
		color: #86efac;
		font-weight: 700;
	}

	.terceros tbody tr.clasifica .c-qlf {
		border-right: 2px solid #4ade80; /* lado derecho */
	}

	.terceros tbody tr.primero td,
	.terceros tbody tr.primero th {
		border-top: 2px solid #4ade80; /* borde superior (sobre el 1º) */
	}

	.terceros tbody tr.corte td,
	.terceros tbody tr.corte th {
		border-bottom: 2px solid #4ade80; /* borde inferior (bajo el 8º) */
	}

	.terceros .qlf {
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #fff;
		text-shadow:
			0 0 4px rgba(255, 255, 255, 0.95),
			0 0 11px rgba(255, 255, 255, 0.6);
		animation: qlf-brillo 2.2s ease-in-out infinite;
	}

	@keyframes qlf-brillo {
		0%,
		100% {
			opacity: 0.82;
		}
		50% {
			opacity: 1;
		}
	}
</style>
