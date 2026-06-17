<script lang="ts">
	import Bandera from '$lib/Bandera.svelte';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Medalla del podio para el lugar al que llega/llegaría cada quien; vacío fuera del top 3.
	const medalla = (lugar: number) =>
		lugar === 1 ? '🥇' : lugar === 2 ? '🥈' : lugar === 3 ? '🥉' : '';

	// Alto dinámico de las listas de los 3 cuadros de "ganadores": crecen para
	// llenar el espacio vertical disponible (sin que la página haga scroll) y, como
	// comparten el mismo tope y el contenedor usa align-items: stretch, los tres
	// quedan parejos de altura. En móvil (apilados) se usa el tope por defecto.
	let listMax = $state(0); // px; 0 = usar el max-height por defecto (CSS)

	$effect(() => {
		if (!browser) return;
		void data.ganando; // re-medir si cambian las tarjetas (nuevo marcador en vivo)

		const medir = () => {
			const fila = document.querySelector('.cards-gan');
			const lista = fila?.querySelector('.gan-list');
			// El scroll vive en .work-scroll (panel fijo del layout), no en la ventana:
			// medimos su borde inferior visible para no provocar su scroll interno.
			const cont = document.querySelector('.work-scroll');
			if (!fila || !lista || !cont) {
				listMax = 0;
				return;
			}
			// Si las tarjetas NO están en una sola fila (móvil, apiladas), usar el
			// tope por defecto para que cada una quede compacta.
			const cards = [...fila.querySelectorAll('.gan-card')];
			const top0 = cards[0].getBoundingClientRect().top;
			const enFila =
				cards.length > 1 && cards.every((c) => Math.abs(c.getBoundingClientRect().top - top0) < 4);
			if (!enFila) {
				listMax = 0;
				return;
			}
			// Alto disponible: del inicio de la lista al fondo visible del área de
			// scroll, menos el padding inferior de la tarjeta (~10) + de la sección
			// (~24) + holgura, para que quepa sin generar scroll.
			const top = lista.getBoundingClientRect().top;
			const fondo = cont.getBoundingClientRect().bottom;
			listMax = Math.max(Math.round(fondo - top - 44), 150);
		};

		const raf = requestAnimationFrame(medir);
		window.addEventListener('resize', medir);
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', medir);
		};
	});

	// Segmentos del pastel (SVG): local / empate / visitante. Cada uno con su lista
	// de nombres (tooltip). Si solo hay un resultado, se dibuja un círculo completo.
	function arcPath(start: number, end: number) {
		const rad = (a: number) => ((a - 90) * Math.PI) / 180;
		const x1 = 50 + 50 * Math.cos(rad(start));
		const y1 = 50 + 50 * Math.sin(rad(start));
		const x2 = 50 + 50 * Math.cos(rad(end));
		const y2 = 50 + 50 * Math.sin(rad(end));
		const large = end - start > 180 ? 1 : 0;
		return `M50,50 L${x1.toFixed(2)},${y1.toFixed(2)} A50,50 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
	}

	const segmentos = $derived.by(() => {
		const g = data.grafica;
		if (!g) return [];
		const defs = [
			{ key: 'l', label: g.equipoA, color: '#4ade80', names: g.localNames },
			{ key: 'e', label: 'Empate', color: '#fbbf24', names: g.empateNames },
			{ key: 'v', label: g.equipoB, color: '#38bdf8', names: g.visitaNames }
		].filter((d) => d.names.length > 0);
		const total = g.total || 1;
		if (defs.length === 1) return [{ ...defs[0], full: true, path: '' }];
		let acc = 0;
		return defs.map((d) => {
			const start = (acc / total) * 360;
			acc += d.names.length;
			return { ...d, full: false, path: arcPath(start, (acc / total) * 360) };
		});
	});
</script>

<!-- Tarjeta reutilizable de "ganadores": vigente y escenarios (+1 local / +1 visita). -->
{#snippet ganadores(
	titulo: string,
	sub: string,
	gn: NonNullable<typeof data.ganando>,
	tono: string,
	vacio: string,
	equipo: string
)}
	<div class="gan-card {tono}">
		<div class="gan-head">
			<span class="gan-anota">
				{titulo}
				{#if equipo}
					<span class="notranslate" translate="no">{equipo}</span>
					<Bandera {equipo} />
				{/if}
			</span>
			<span class="gan-score">{gn.real.replace('-', ' – ')}</span>
		</div>
		{#if sub}
			<div class="gan-sub">{sub}</div>
		{/if}
		{#if gn.lista.length}
			<ul class="gan-list">
				{#each gn.lista as g, i (i)}
					<li class:exa={g.exacto}>
						<span class="gan-lugar" title="Lugar {g.lugar}">
							{#if medalla(g.lugar)}<span class="gan-medalla" aria-hidden="true"
									>{medalla(g.lugar)}</span
								>{/if}<span class="gan-num">{g.lugar}°</span>
						</span>
						<span class="gan-badge">{g.exacto ? '🎯 3 pts' : '✓ 1 pt'}</span>
						<span class="gan-nombre notranslate" translate="no">{g.nombre}</span>
						{#if g.mov > 0}
							<span class="gan-mov" title="Subiría {g.mov} lugar(es) en la tabla">▲{g.mov}</span>
						{/if}
						<span class="gan-prono">{g.pronostico}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="gan-vacio">{vacio}</p>
		{/if}
	</div>
{/snippet}

<section class="estadisticas">
	<p class="sub">
		Distribución de pronósticos del partido en curso (o el siguiente pendiente) y los partidos en
		vivo.
	</p>

	{#if data.enCurso.length || data.grafica}
		<!-- Fila 1: las dos tarjetas "cortas" (partido en curso + pastel). -->
		<div class="cards">
			{#if data.enCurso.length}
				<div class="vivo-card">
					<span class="bv-tag"
						><span class="bv-dot" aria-hidden="true"></span> Partido en Curso</span
					>
					{#each data.enCurso as m (m.numero)}
						<span class="bv-match">
							<span class="bv-num">#{m.numero}</span>
							<span class="bv-team notranslate" translate="no">{m.equipoA}</span>
							<Bandera equipo={m.equipoA} />
							<span class="bv-score">{m.real?.replace('-', ' – ')}</span>
							<Bandera equipo={m.equipoB} />
							<span class="bv-team notranslate" translate="no">{m.equipoB}</span>
						</span>
					{/each}
				</div>
			{/if}

			{#if data.grafica}
				{@const g = data.grafica}
				<div class="pie-card">
					<div class="pie-title">{g.enCurso ? '● En curso' : 'Siguiente'} · #{g.numero}</div>
					<div class="pie-row">
						<svg
							class="pie"
							viewBox="0 0 100 100"
							role="img"
							aria-label="Desglose de pronósticos"
						>
							{#each segmentos as s (s.key)}
								{#if s.full}
									<circle
										cx="50"
										cy="50"
										r="50"
										fill={s.color}
										stroke="rgba(0,0,0,0.25)"
										stroke-width="0.5"
									>
										<title>{s.label}: {s.names.join(', ')}</title>
									</circle>
								{:else}
									<path d={s.path} fill={s.color} stroke="rgba(0,0,0,0.3)" stroke-width="0.6">
										<title>{s.label}: {s.names.join(', ')}</title>
									</path>
								{/if}
							{/each}
						</svg>
						<ul class="pie-leg">
							<li title="{g.equipoA}: {g.localNames.join(', ')}">
								<span class="pdot l"></span> <span class="pnm notranslate" translate="no">{g.equipoA}</span> <b>{g.local}</b>
							</li>
							<li title="Empate: {g.empateNames.join(', ')}">
								<span class="pdot e"></span> <span class="pnm">Empate</span> <b>{g.empate}</b>
							</li>
							<li title="{g.equipoB}: {g.visitaNames.join(', ')}">
								<span class="pdot v"></span> <span class="pnm notranslate" translate="no">{g.equipoB}</span> <b>{g.visita}</b>
							</li>
						</ul>
					</div>
				</div>
			{/if}
		</div>

		<!-- Fila 2 (aparte, abajo): tarjetas de "ganadores", más altas por sus listas. -->
		{#if data.ganando}
			<div class="cards cards-gan" style={listMax ? `--gan-list-max: ${listMax}px` : ''}>
				{@render ganadores(
					data.pendiente ? 'Ganando puntos si va así:' : 'Ganando puntos con resultado actual:',
					'',
					data.ganando,
					'vig',
					'Nadie va ganando puntos con este marcador.',
					''
				)}
				{#if data.golLocal}
					{@render ganadores(
						'Si anota',
						'',
						data.golLocal,
						'loc',
						'Nadie ganaría puntos con ese marcador.',
						data.golLocal.equipoA
					)}
				{/if}
				{#if data.golVisita}
					{@render ganadores(
						'Si anota',
						'',
						data.golVisita,
						'vis',
						'Nadie ganaría puntos con ese marcador.',
						data.golVisita.equipoB
					)}
				{/if}
			</div>
		{/if}

		{#if !data.enCurso.length}
			<p class="nota">
				No hay ningún partido en curso: las tarjetas asumen el siguiente partido en 0-0 de salida.
			</p>
		{/if}
	{:else}
		<p class="empty">Ya se jugaron todos los partidos: no hay nada en curso ni pendiente.</p>
	{/if}
</section>

<style>
	.estadisticas {
		box-sizing: border-box;
		padding: 0.4rem 1.5rem 1.5rem;
		color: rgba(255, 255, 255, 0.95);
	}

	.sub {
		margin: 0.2rem 0 1rem;
		font-size: 0.85rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.65);
	}

	/* Las dos tarjetas, lado a lado (envuelven en móvil). Mismo orden que en
	   Participantes: primero el partido en curso, luego el pastel. */
	.cards {
		display: flex;
		flex-wrap: wrap;
		align-items: stretch;
		gap: 1rem 1.25rem;
	}

	/* Segunda fila: las tarjetas de "ganadores" (más altas por sus listas), en su
	   propia línea para no descuadrar a las dos cortas de arriba. */
	.cards-gan {
		margin-top: 1.1rem;
	}

	.nota,
	.empty {
		margin: 1rem 0 0;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.6);
	}

	/* ── Tarjeta "Partido en Curso" (copia de Participantes) ───────────────── */
	.vivo-card {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: flex-start;
		gap: 0.5rem;
		min-width: 13rem;
		padding: 0.6rem 0.9rem;
		background: rgba(245, 158, 11, 0.13);
		border: 1px solid rgba(245, 158, 11, 0.55);
		border-radius: 10px;
		color: #fde68a;
		animation: glow-banner 1.9s ease-in-out infinite;
	}

	@keyframes glow-banner {
		0%,
		100% {
			box-shadow: 0 0 6px rgba(245, 158, 11, 0.22);
		}
		50% {
			box-shadow: 0 0 15px rgba(245, 158, 11, 0.5);
		}
	}

	.bv-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: #fcd34d;
		white-space: nowrap;
	}

	.bv-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: #f59e0b;
		animation: halo 1.6s ease-out infinite;
	}

	@keyframes halo {
		0% {
			box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6);
		}
		70% {
			box-shadow: 0 0 0 7px rgba(245, 158, 11, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
		}
	}

	.bv-match {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.9rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.bv-num {
		font-size: 0.72rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.55);
	}

	.bv-score {
		padding: 0.05rem 0.55rem;
		background: rgba(0, 0, 0, 0.22);
		border-radius: 6px;
		font-variant-numeric: tabular-nums;
		color: #fff;
	}

	/* ── Gráfica de pastel (copia de Participantes) ────────────────────────── */
	.pie-card {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.6rem 0.9rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
	}

	.pie-title {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		color: rgba(255, 255, 255, 0.7);
	}

	.pie-row {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.pie {
		width: 92px;
		height: 92px;
		flex-shrink: 0;
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.25));
	}

	.pie path,
	.pie circle {
		cursor: default;
		transition: opacity 0.15s ease;
	}

	.pie:hover path,
	.pie:hover circle {
		opacity: 0.6;
	}

	.pie path:hover,
	.pie circle:hover {
		opacity: 1;
	}

	.pie-leg {
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: 0.72rem;
		display: flex;
		flex-direction: column;
		gap: 0.18rem;
	}

	.pie-leg li {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		white-space: nowrap;
	}

	.pnm {
		max-width: 8rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pie-leg b {
		margin-left: 0.1rem;
		font-variant-numeric: tabular-nums;
	}

	.pdot {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.pdot.l {
		background: #4ade80;
	}

	.pdot.e {
		background: #fbbf24;
	}

	.pdot.v {
		background: #38bdf8;
	}

	/* ── Tarjeta "Ganando puntos" (con el marcador vigente del partido en curso) ── */
	.gan-card {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 14rem;
		max-width: 28rem;
		padding: 0.6rem 0.9rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
	}

	/* Escenarios "+1 gol": franja superior con el color del lado (local verde /
	   visita azul, igual que el pastel) para distinguirlos del marcador vigente. */
	.gan-card.loc {
		border-top: 2px solid rgba(74, 222, 128, 0.7);
	}

	.gan-card.vis {
		border-top: 2px solid rgba(56, 189, 248, 0.7);
	}

	/* Tarjeta del marcador vigente: marco ámbar + halo pulsante, igual que la
	   tarjeta de "Partido en Curso" (reusa la animación glow-banner). */
	.gan-card.vig {
		border-color: rgba(245, 158, 11, 0.55);
		animation: glow-banner 1.9s ease-in-out infinite;
	}

	.gan-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}

	/* Encabezado de las 3 tarjetas: título + (bandera opcional), grande y
	   blanco e igual en todas. La bandera escala con el font-size del contenedor. */
	.gan-anota {
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.2rem 0.4rem;
		min-width: 0;
		font-size: 1rem;
		font-weight: 700;
		color: #fff;
	}

	.gan-score {
		flex-shrink: 0;
		white-space: nowrap;
		padding: 0.05rem 0.5rem;
		background: rgba(0, 0, 0, 0.22);
		border-radius: 6px;
		font-size: 0.8rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: #fff;
	}

	.gan-sub {
		font-size: 0.66rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.gan-list {
		list-style: none;
		margin: 0.1rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		/* Tope dinámico (lo fija el JS para llenar el viewport); 16rem por defecto
		   (SSR / móvil apilado). El mismo tope en los 3 + stretch = altura pareja. */
		max-height: var(--gan-list-max, 16rem);
		overflow-y: auto;
	}

	/* Acierto de resultado (1 pt): rosa mexicano (igual que la cuadrícula). */
	.gan-list li {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.25rem 0.45rem;
		border-radius: 6px;
		font-size: 0.8rem;
		background: rgba(240, 76, 158, 0.14);
		border-left: 3px solid rgba(240, 76, 158, 0.7);
	}

	/* Marcador exacto (3 pts): ámbar (resalta sobre el verde), hasta arriba. */
	.gan-list li.exa {
		background: rgba(245, 158, 11, 0.22);
		border-left-color: rgba(245, 158, 11, 0.95);
	}

	/* Lugar al que llega/llegaría: medalla (podio) + número, pegado a la izquierda.
	   Caja de ancho fijo y alineada a la derecha para que los badges de pts queden parejos. */
	.gan-lugar {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.1rem;
		min-width: 2.6rem;
		font-size: 0.8rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: #fff;
	}

	.gan-medalla {
		font-size: 0.85rem;
		line-height: 1;
	}

	.gan-num {
		color: rgba(255, 255, 255, 0.92);
	}

	.gan-badge {
		flex-shrink: 0;
		font-size: 0.6rem;
		font-weight: 700;
		padding: 0.05rem 0.32rem;
		border-radius: 5px;
		white-space: nowrap;
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
	}

	/* Badge del "3 pts" (exacto): ámbar sólido con texto oscuro (alto contraste). */
	.gan-list li.exa .gan-badge {
		background: rgba(245, 158, 11, 0.9);
		color: #422006;
	}

	.gan-nombre {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 700;
	}

	/* Flechita: cuántos lugares SUBIRÍA en la tabla si el partido terminara con
	   este marcador (vs la tabla sin contarlo). Solo se muestra si sube (▲ verde). */
	.gan-mov {
		flex-shrink: 0;
		font-size: 0.68rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: #4ade80;
	}

	.gan-prono {
		flex-shrink: 0;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		color: rgba(255, 255, 255, 0.7);
	}

	.gan-vacio {
		margin: 0.2rem 0 0;
		font-size: 0.78rem;
		color: rgba(255, 255, 255, 0.6);
	}
</style>
