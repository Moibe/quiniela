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
	<div class="head">
		<h1>Resultados</h1>
	</div>

	<p class="sub">
		Resultados oficiales de los 72 partidos de fase de grupos.{#if data.isAdmin}
			Captura o edita el marcador real de cada partido.{/if}
	</p>

	<ul class="list">
		{#each data.partidos as p (p.id)}
			{@const jugado = p.golesA !== null && p.golesB !== null}
			<li class="partido" class:jugado>
				<span class="num">#{p.numero}</span>
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
						<button type="submit" class="save-btn" title="Guardar resultado" aria-label="Guardar">✓</button>
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

				<span class="meta">
					{#if jugado}
						<time class="when">{fmtFecha(p.fecha as Date)}</time>
						{#if data.isAdmin}
							<form method="POST" action="?/clearResult" use:enhance class="clear-form">
								<input type="hidden" name="partidoId" value={p.id} />
								<button type="submit" class="clear-btn" title="Limpiar resultado" aria-label="Limpiar">✕</button>
							</form>
						{/if}
					{:else}
						<span class="pendiente">pendiente</span>
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
		padding: 1.5rem 1.75rem;
		color: rgba(255, 255, 255, 0.95);
	}

	.head {
		margin-bottom: 0.4rem;
	}

	h1 {
		margin: 0;
		font-size: 1.6rem;
		text-shadow:
			0 0 10px rgba(255, 255, 255, 0.28),
			0 0 24px rgba(255, 255, 255, 0.14);
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
		grid-template-columns: 2.6rem minmax(0, 1fr) auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.8rem;
		padding: 0.5rem 0.9rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
	}

	.partido.jugado {
		background: rgba(34, 197, 94, 0.08);
		border-color: rgba(34, 197, 94, 0.28);
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
		gap: 0.35rem;
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

	.meta {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: flex-end;
		min-width: 6.5rem;
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
</style>
