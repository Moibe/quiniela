<script lang="ts">
	import Bandera from '$lib/Bandera.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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

<section class="estadisticas">
	<p class="sub">
		Distribución de pronósticos del partido en curso (o el siguiente pendiente) y los partidos en
		vivo.
	</p>

	{#if data.enCurso.length || data.grafica}
		<div class="cards">
			{#if data.enCurso.length}
				<div class="vivo-card">
					<span class="bv-tag"
						><span class="bv-dot" aria-hidden="true"></span> Partido en Curso</span
					>
					{#each data.enCurso as m (m.numero)}
						<span class="bv-match">
							<span class="bv-num">#{m.numero}</span>
							<span class="bv-team">{m.equipoA}</span>
							<Bandera equipo={m.equipoA} />
							<span class="bv-score">{m.real?.replace('-', ' – ')}</span>
							<Bandera equipo={m.equipoB} />
							<span class="bv-team">{m.equipoB}</span>
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
								<span class="pdot l"></span> <span class="pnm">{g.equipoA}</span> <b>{g.local}</b>
							</li>
							<li title="Empate: {g.empateNames.join(', ')}">
								<span class="pdot e"></span> <span class="pnm">Empate</span> <b>{g.empate}</b>
							</li>
							<li title="{g.equipoB}: {g.visitaNames.join(', ')}">
								<span class="pdot v"></span> <span class="pnm">{g.equipoB}</span> <b>{g.visita}</b>
							</li>
						</ul>
					</div>
				</div>
			{/if}
		</div>

		{#if !data.enCurso.length}
			<p class="nota">No hay ningún partido en curso ahora mismo.</p>
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
</style>
