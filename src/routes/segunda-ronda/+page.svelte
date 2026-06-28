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
	// Orden de los 16avos en cada mitad del bracket (aplanando los pares). Emparejar consecutivos en
	// este orden reproduce TODO el cuadro: 16avos → octavos → cuartos → semis → final (centro).
	const porNum = $derived(new Map(data.cruces.map((c) => [c.numero, c])));
	const aCruces = (ps: number[][]) =>
		ps.flat().map((n) => porNum.get(n)).filter((c): c is (typeof data.cruces)[number] => !!c);
	const izq = $derived(aCruces(PARES_OFICIALES.slice(0, 4)));
	const der = $derived(aCruces(PARES_OFICIALES.slice(4, 8)));
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
		<div class="match" class:confirmado={data.esReal && c.confirmado}>
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
		<p class="swipe-hint" aria-hidden="true">Desliza el cuadro →</p>
		<div class="bracket">
			<div class="lado izq">
				<div class="ronda r32">
					{#each izq as c (c.numero)}<div class="cell">{@render matchBox(c)}</div>{/each}
				</div>
				<div class="ronda con">{#each [0, 1, 2, 3] as i (i)}<div class="cell"></div>{/each}</div>
				<div class="ronda con">{#each [0, 1] as i (i)}<div class="cell"></div>{/each}</div>
				<div class="ronda con fin">{#each [0] as i (i)}<div class="cell"></div>{/each}</div>
			</div>
			<div class="centro" aria-hidden="true"><span class="trofeo">🏆</span></div>
			<div class="lado der">
				<div class="ronda con fin">{#each [0] as i (i)}<div class="cell"></div>{/each}</div>
				<div class="ronda con">{#each [0, 1] as i (i)}<div class="cell"></div>{/each}</div>
				<div class="ronda con">{#each [0, 1, 2, 3] as i (i)}<div class="cell"></div>{/each}</div>
				<div class="ronda r32">
					{#each der as c (c.numero)}<div class="cell">{@render matchBox(c)}</div>{/each}
				</div>
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

	/* Bracket COMPLETO: dos mitades en rondas (16avos → octavos → cuartos → semis) que convergen al
	   centro (la copa). Las rondas intermedias son columnas VACÍAS: solo aportan los puntos de unión y
	   las "patitas". Las celdas usan flex:1 para que sus centros se alineen entre rondas (8→4→2→1), así
	   los conectores caen justo en cada cruce. */
	.bracket {
		--linea: rgba(34, 197, 94, 0.55);
		--gap: 1.15rem;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow-x: auto;
		padding-bottom: 0.5rem;
	}

	.lado {
		display: flex;
		align-items: stretch;
		gap: var(--gap);
	}

	.ronda {
		display: flex;
		flex-direction: column;
	}

	.ronda .cell {
		flex: 1 1 0;
		display: flex;
		align-items: center;
		position: relative;
	}

	/* La columna de 16avos define la altura (y el espaciado) del bracket. */
	.ronda.r32 .cell {
		min-height: 4rem;
	}

	/* Conectores ("patitas"): cada celda de ronda intermedia dibuja la llave entrante (vertical + 2
	   brazos) hacia sus dos alimentadoras de la ronda previa. Izquierda mira a la izquierda; la mitad
	   derecha, reflejada, mira a la derecha. */
	.lado.izq .ronda.con .cell::before {
		content: '';
		position: absolute;
		right: 100%;
		top: 25%;
		bottom: 25%;
		width: var(--gap);
		border-right: 2px solid var(--linea);
		border-top: 2px solid var(--linea);
		border-bottom: 2px solid var(--linea);
	}

	.lado.der .ronda.con .cell::before {
		content: '';
		position: absolute;
		left: 100%;
		top: 25%;
		bottom: 25%;
		width: var(--gap);
		border-left: 2px solid var(--linea);
		border-top: 2px solid var(--linea);
		border-bottom: 2px solid var(--linea);
	}

	/* Tramo final: de la semifinal de cada lado a la copa (centro). */
	.lado.izq .ronda.fin .cell::after,
	.lado.der .ronda.fin .cell::after {
		content: '';
		position: absolute;
		top: 50%;
		width: calc(var(--gap) + 0.3rem);
		border-top: 2px solid var(--linea);
	}
	.lado.izq .ronda.fin .cell::after {
		left: 100%;
	}
	.lado.der .ronda.fin .cell::after {
		right: 100%;
	}

	.centro {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		filter: drop-shadow(0 0 8px rgba(250, 204, 21, 0.45));
		/* La copa va ENCIMA de las patitas: los conectores son pseudo-elementos posicionados que, sin
		   esto, se pintan sobre la copa. position+z-index la dejan al frente. */
		position: relative;
		z-index: 3;
	}

	.match {
		position: relative;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		width: 13rem;
		padding: 0.4rem 0.6rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
	}

	/* Cruce CONFIRMADO (ya no puede cambiar): marco DORADO + brillo suave. Solo en la vista Real. */
	.match.confirmado {
		border-color: rgba(250, 204, 21, 0.85);
		box-shadow:
			0 0 0 1px rgba(250, 204, 21, 0.4),
			0 0 12px rgba(250, 204, 21, 0.3);
	}

	/* Número de partido (#73…): al borde EXTERIOR (izquierda en la mitad izquierda; derecha en la
	   mitad derecha, ver abajo) y CENTRADO verticalmente entre las dos filas. Antes iba arriba a la
	   derecha y se encimaba con la insignia de grupo (2°A). El hueco lo da el padding exterior del
	   .match (definido por mitad más abajo). */
	.mnum {
		position: absolute;
		left: 0.35rem;
		top: 50%;
		transform: translateY(-50%);
		font-size: 0.56rem;
		line-height: 1;
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

	/* Mitad derecha: 16avos reflejados (bandera a la derecha, etiqueta hacia el centro). */
	.lado.der .ronda.r32 .team {
		flex-direction: row-reverse;
	}

	.lado.der .ronda.r32 .team .org {
		margin-left: 0;
		margin-right: auto;
	}

	.lado.der .ronda.r32 .mnum {
		left: auto;
		right: 0.35rem;
	}

	/* Hueco EXTERIOR para el número (lado opuesto a las insignias de grupo): izquierda en la mitad
	   izquierda, derecha en la derecha. Así el número cabe centrado sin pisar banderas ni los "2°A". */
	.lado.izq .ronda.r32 .match {
		padding-left: 1.7rem;
	}

	.lado.der .ronda.r32 .match {
		padding-right: 1.7rem;
	}

	/* Pista "desliza" (solo móvil; la regla base la oculta para no tocar el desktop). */
	.swipe-hint {
		display: none;
	}

	/* Móvil/angosto: se CONSERVA el árbol completo (misma topología, conectores y copa); solo el
	   .bracket hace scroll horizontal. Antes se pasaba a columna sin resetear las celdas (flex:1 1 0),
	   que sin altura definida colapsaban a 0 y encimaban los 16 partidos. Aquí mantenemos la FILA y el
	   min-height de las celdas, y el árbol toma su ancho natural para que overflow-x sí desplace. */
	@media (max-width: 920px) {
		.swipe-hint {
			display: flex;
			align-items: center;
			gap: 0.35rem;
			width: max-content;
			margin: 0 0 0.5rem;
			padding: 0.2rem 0.65rem;
			font-size: 0.72rem;
			font-weight: 700;
			color: #86efac;
			background: rgba(34, 197, 94, 0.12);
			border: 1px solid rgba(34, 197, 94, 0.35);
			border-radius: 999px;
			animation: swipeNudge 1.8s ease-in-out infinite;
		}
		.bracket {
			--gap: 0.55rem;
			flex-direction: row;
			align-items: center;
			justify-content: flex-start;
			overflow-x: auto;
			overflow-y: hidden;
			-webkit-overflow-scrolling: touch;
			overscroll-behavior-x: contain;
			padding-bottom: 0.6rem;
		}
		.lado {
			flex-direction: row;
			align-items: stretch;
			gap: var(--gap);
			flex: 0 0 auto;
		}
		.ronda.con,
		.centro {
			display: flex;
		}
		.centro {
			font-size: 1.4rem;
		}
		.ronda.r32 .cell {
			min-height: 3.1rem;
			margin-bottom: 0;
		}
		.match {
			width: 10rem;
			padding: 0.3rem 0.45rem;
		}
		.team {
			gap: 0.3rem;
		}
		.team .nm {
			font-size: 0.74rem;
		}
		.team .org {
			font-size: 0.5rem;
		}
		.mnum {
			font-size: 0.5rem;
		}
	}

	@keyframes swipeNudge {
		0%,
		100% {
			transform: translateX(0);
		}
		50% {
			transform: translateX(4px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.swipe-hint {
			animation: none;
		}
	}
</style>
