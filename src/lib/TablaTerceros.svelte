<script lang="ts">
	import Bandera from '$lib/Bandera.svelte';

	// Un tercero de la tabla "carrera por los 8 mejores". Misma forma en Grupos (derivado) y En Vivo
	// (TerceroEnVivo): grupo, equipo, pj, dg, pts, si está entre los 8 que clasifican y si su grupo
	// aún no termina (enVivo = juega ahora mismo).
	type Tercero = {
		grupo: string;
		equipo: string;
		pj: number;
		dg: number;
		pts: number;
		clasifica: boolean;
		enVivo: boolean;
	};

	// open: arranca desplegada (por defecto NO — se muestra solo el encabezado replegable).
	// flotante: al abrir, la tabla flota como popover (no empuja el contenido de abajo). Lo usa Grupos,
	// donde va junto al título con la lista de grupos debajo; En Vivo la deja apilada en flujo normal.
	let {
		terceros,
		open = false,
		flotante = false
	}: { terceros: Tercero[]; open?: boolean; flotante?: boolean } = $props();
</script>

{#if terceros.length}
	<details class="terceros" class:flotante {open}>
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
								<span class="eq-in">
									<Bandera equipo={t.equipo} />
									<span class="nm" translate="no">{t.equipo}</span>
									{#if t.enVivo || t.pj < 3}
										<span
											class="pendiente"
											class:jugando={t.enVivo}
											title={t.enVivo
												? 'Jugando ahora — su posición puede cambiar'
												: 'Aún tiene partidos por jugar'}
											aria-label="con partidos pendientes">⚽</span
										>
									{/if}
								</span>
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

	/* Modo FLOTANTE (Grupos): al abrir, la barra (summary) se queda en su lugar y la TABLA cae como
	   popover absoluto encima del contenido de abajo, sin empujarlo. Fondo sólido + sombra para que
	   se lea sobre las tablas de grupo. */
	.terceros.flotante {
		position: relative;
	}

	.terceros.flotante[open] {
		overflow: visible;
	}

	.terceros.flotante[open] .t-tabla {
		position: absolute;
		top: calc(100% + 0.4rem);
		left: 0;
		right: 0;
		z-index: 30;
		max-height: 70vh;
		overflow: auto;
		background: #0c2f1c;
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 10px;
		box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5);
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
	}

	/* El flex va en un span INTERNO, no en la celda: una celda con display:flex deja de ser table-cell
	   y descuadra los bordes de la tabla. */
	.terceros .c-eq .eq-in {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	/* Balón ⚽: el grupo de este tercero aún NO termina (le faltan partidos) o está jugando AHORA
	   (.jugando → pulso suave). Avisa que su posición es provisional. */
	.terceros .pendiente {
		flex-shrink: 0;
		font-size: 0.72rem;
		line-height: 1;
	}

	.terceros .pendiente.jugando {
		animation: balon-late 1.3s ease-in-out infinite;
	}

	@keyframes balon-late {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	.terceros .c-pts {
		font-weight: 700;
		color: #bbf7d0;
	}

	.terceros .c-qlf {
		width: 2.6rem;
	}

	/* Los 8 que clasifican: fondo verde tenue + un MARCO verde COMPLETO rodeando el bloque. El marco se
	   dibuja con box-shadow (NO con border): el border-collapse de la tabla fusiona las esquinas de los
	   bordes por celda y la línea se veía chueca/escalonada. box-shadow se pinta por celda, recto. */
	.terceros tbody tr.clasifica {
		background: rgba(34, 197, 94, 0.08);
	}

	.terceros tbody tr.clasifica .c-pos {
		box-shadow: inset 2px 0 0 #4ade80; /* línea izquierda */
		color: #86efac;
		font-weight: 700;
	}

	.terceros tbody tr.clasifica .c-qlf {
		box-shadow: inset -2px 0 0 #4ade80; /* línea derecha */
	}

	.terceros tbody tr.primero td,
	.terceros tbody tr.primero th {
		box-shadow: inset 0 2px 0 #4ade80; /* línea superior (sobre el 1º) */
	}

	.terceros tbody tr.corte td,
	.terceros tbody tr.corte th {
		box-shadow: inset 0 -2px 0 #4ade80; /* línea inferior (bajo el 8º) */
	}

	/* Esquinas: combinan dos lados (van al final para ganar a las reglas de borde simple de arriba). */
	.terceros tbody tr.primero .c-pos {
		box-shadow:
			inset 2px 0 0 #4ade80,
			inset 0 2px 0 #4ade80;
	}

	.terceros tbody tr.primero .c-qlf {
		box-shadow:
			inset -2px 0 0 #4ade80,
			inset 0 2px 0 #4ade80;
	}

	.terceros tbody tr.corte .c-pos {
		box-shadow:
			inset 2px 0 0 #4ade80,
			inset 0 -2px 0 #4ade80;
	}

	.terceros tbody tr.corte .c-qlf {
		box-shadow:
			inset -2px 0 0 #4ade80,
			inset 0 -2px 0 #4ade80;
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
