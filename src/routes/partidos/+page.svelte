<script lang="ts">
	import { enhance } from '$app/forms';
	import Bandera from '$lib/Bandera.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const actionError = $derived(form && 'error' in form ? form : null);

	const fmtFecha = (d: Date) =>
		new Intl.DateTimeFormat('es-MX', {
			day: '2-digit',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		}).format(d);
</script>

<section class="resultados">
	<p class="sub">
		Resultados oficiales de los 72 partidos de fase de grupos.{#if data.isAdmin}
			<strong>✓</strong> guarda el resultado final · <strong>⏱</strong> guarda un parcial y marca «Partido
			en Curso» (captura en vivo).{/if}
	</p>

	<ul class="list">
		{#each data.partidos as p (p.id)}
			{@const jugado = p.golesA !== null && p.golesB !== null}
			<li class="partido" class:jugado class:encurso={p.enCurso}>
				<span class="num">#{p.numero}</span>

					<div class="cuerpo">
				<span class="team a">
					<span class="tname">{p.equipoA}</span>
					<Bandera equipo={p.equipoA} />
				</span>

				{#if data.isAdmin}
					<form method="POST" action="?/setResult" use:enhance class="score-form">
						<input type="hidden" name="partidoId" value={p.id} />
						<input
							class="score-in"
							type="number"
							name="golesA"
							min="0"
							inputmode="numeric"
							placeholder="–"
							value={p.golesA ?? ''}
						/>
						<span class="dash">–</span>
						<input
							class="score-in"
							type="number"
							name="golesB"
							min="0"
							inputmode="numeric"
							placeholder="–"
							value={p.golesB ?? ''}
						/>
						<button type="submit" class="save-btn" title="Guardar resultado FINAL" aria-label="Guardar final">✓</button>
						<button
							type="submit"
							formaction="?/setPartial"
							class="save-btn partial"
							title="Guardar PARCIAL · marca «Partido en Curso» (captura en vivo)"
							aria-label="Guardar parcial">⏱</button
						>
					</form>
				{:else if jugado}
					<span class="score-box">{p.golesA}<span class="sep">–</span>{p.golesB}</span>
				{:else}
					<span class="score-box pending">–<span class="sep">–</span>–</span>
				{/if}

				<span class="team b">
					<Bandera equipo={p.equipoB} />
					<span class="tname">{p.equipoB}</span>
				</span>

				</div>

					<span class="meta">
					{#if p.enCurso}
						<span class="encurso-badge"><span class="dot-live" aria-hidden="true"></span> Partido en Curso</span>
					{:else if jugado}
						<time class="when">{fmtFecha(p.fecha as Date)}</time>
					{:else}
						<span class="pendiente">pendiente</span>
					{/if}
					{#if data.isAdmin && jugado}
						<form method="POST" action="?/clearResult" use:enhance class="clear-form">
							<input type="hidden" name="partidoId" value={p.id} />
							<button type="submit" class="clear-btn" title="Limpiar resultado" aria-label="Limpiar">✕</button>
						</form>
					{/if}
				</span>

				{#if actionError && actionError.partidoId === p.id}
					<span class="row-error">{actionError.error}</span>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	.resultados {
		padding: 0.85rem 1.75rem 1.25rem;
		color: rgba(255, 255, 255, 0.95);
	}

	.sub {
		margin: 0 0 1.25rem;
		font-size: 0.85rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.6);
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.partido {
		display: grid;
		grid-template-columns: 2.6rem 1fr 10rem; /* # | cuerpo (equipos+marcador) | meta */
		align-items: center;
		gap: 0.8rem;
		padding: 0.5rem 0.9rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
	}

	/* Cuerpo del partido (equipos + marcador): vive en la columna central (1fr),
	   de ancho CONSTANTE e independiente de lo que tenga la derecha. Así centra
	   equipos y marcador IGUAL en todas las filas (jugado, en curso o pendiente). */
	.cuerpo {
		min-width: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 0.8rem;
	}

	.partido.jugado {
		background: rgba(34, 197, 94, 0.08);
		border-color: rgba(34, 197, 94, 0.28);
	}

	/* Partido en curso (marcador provisional): se distingue en ÁMBAR/dorado —
	   fondo y borde ámbar + texto dorado en toda la fila (equipos y marcador). */
	.partido.encurso {
		background: rgba(245, 158, 11, 0.15);
		border-color: rgba(245, 158, 11, 0.6);
		color: #fde68a;
	}

	.num {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.45);
	}

	.team {
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.team.a {
		justify-content: flex-end; /* nombre + bandera, hacia el centro */
	}

	.team.b {
		justify-content: flex-start; /* bandera + nombre, hacia el centro */
	}

	.tname {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.score-box {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		min-width: 3rem;
		font-size: 1.05rem;
		padding: 0.1rem 0.65rem;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
	}

	.score-box.pending {
		color: rgba(255, 255, 255, 0.35);
	}

	.sep {
		opacity: 0.5;
	}

	.score-form {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.score-in {
		width: 2.6rem;
		text-align: center;
		font: inherit;
		color: #fff;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 7px;
		padding: 0.3rem 0.2rem;
		color-scheme: dark;
		/* Sin flechitas de spinner: el número se escribe directo. */
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.score-in::-webkit-outer-spin-button,
	.score-in::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.score-in:focus {
		outline: none;
		border-color: rgba(34, 197, 94, 0.6);
		box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25);
	}

	.dash {
		opacity: 0.6;
	}

	.save-btn {
		font: inherit;
		cursor: pointer;
		padding: 0.3rem 0.55rem;
		color: #fff;
		background: rgba(34, 197, 94, 0.22);
		border: 1px solid rgba(34, 197, 94, 0.5);
		border-radius: 7px;
		transition: background 0.18s ease, border-color 0.18s ease;
	}

	.save-btn:hover {
		background: rgba(34, 197, 94, 0.32);
		border-color: rgba(34, 197, 94, 0.7);
	}

	/* Botón de guardado PARCIAL (en curso): ámbar, para diferenciarlo del ✓ verde. */
	.save-btn.partial {
		background: rgba(245, 158, 11, 0.2);
		border-color: rgba(245, 158, 11, 0.5);
	}

	.save-btn.partial:hover {
		background: rgba(245, 158, 11, 0.34);
		border-color: rgba(245, 158, 11, 0.72);
	}

	/* Ancho FIJO de la columna derecha: así el partido (equipos + marcador) queda
	   en la MISMA posición en todas las filas, sin importar si a la derecha va la
	   hora, "pendiente" o la leyenda "Partido en Curso". */
	/* Columna derecha (ancho fijo 10rem en el grid): contenido alineado a la
	   derecha. El ancho fijo + el cuerpo central hacen que el partido quede en la
	   misma posición en todas las filas. */
	.meta {
		justify-self: end;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.when {
		font-size: 0.72rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.pendiente {
		font-size: 0.72rem;
		font-style: italic;
		color: rgba(255, 255, 255, 0.4);
	}

	/* Leyenda "Partido en Curso" a la derecha (dentro de meta, ancho fijo), con
	   punto pulsante (en vivo). Clase propia (NO .encurso) para no colisionar con
	   la fila .partido.encurso, cuyo `display: grid` se rompía con este inline-flex. */
	.encurso-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		font-weight: 700;
		color: #fcd34d;
		white-space: nowrap;
	}

	.dot-live {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #f59e0b;
		animation: pulso 1.6s ease-out infinite;
	}

	@keyframes pulso {
		0% {
			box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55);
		}
		70% {
			box-shadow: 0 0 0 6px rgba(245, 158, 11, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
		}
	}

	.clear-form {
		margin: 0;
	}

	.clear-btn {
		font: inherit;
		font-size: 0.72rem;
		cursor: pointer;
		padding: 0.15rem 0.4rem;
		color: rgba(255, 255, 255, 0.55);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 6px;
		transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
	}

	.clear-btn:hover {
		background: rgba(239, 68, 68, 0.18);
		border-color: rgba(239, 68, 68, 0.5);
		color: #fca5a5;
	}

	.row-error {
		grid-column: 1 / -1;
		font-size: 0.78rem;
		color: #fca5a5;
	}

	/* En móvil la columna derecha se ajusta al contenido (no fija 10rem) para que
	   no se aprieten los equipos. */
	@media (max-width: 620px) {
		.partido {
			grid-template-columns: 2.2rem 1fr auto;
		}
	}
</style>
