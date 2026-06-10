<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<section class="acceso">
	<div class="card">
		<h1>Acceso de administrador</h1>
		<p class="hint">
			Solo el administrador puede registrar resultados. Los demás pueden ver todo sin iniciar sesión.
		</p>

		<form method="POST" action="?/login&redirectTo={encodeURIComponent(data.redirectTo)}" use:enhance>
			<!-- svelte-ignore a11y_autofocus: página dedicada a un solo input; enfocarlo es la acción esperada -->
			<input
				type="password"
				name="password"
				placeholder="Contraseña de admin"
				autocomplete="current-password"
				aria-label="Contraseña de admin"
				required
				autofocus
			/>
			<button type="submit" class="enter-btn">Entrar</button>
			{#if form?.error}
				<p class="error">{form.error}</p>
			{/if}
		</form>

		<a class="back" href={data.redirectTo}>← Volver</a>
	</div>
</section>

<style>
	.acceso {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100%;
		padding: 2rem 1.5rem;
		box-sizing: border-box;
	}

	.card {
		width: 100%;
		max-width: 26rem;
		padding: 1.75rem 1.6rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 14px;
		color: rgba(255, 255, 255, 0.95);
	}

	h1 {
		margin: 0 0 0.4rem;
		font-size: 1.3rem;
		text-shadow:
			0 0 10px rgba(255, 255, 255, 0.28),
			0 0 24px rgba(255, 255, 255, 0.14);
	}

	.hint {
		margin: 0 0 1.25rem;
		font-size: 0.85rem;
		font-weight: 400;
		line-height: 1.45;
		color: rgba(255, 255, 255, 0.65);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	input {
		font: inherit;
		color: #fff;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 9px;
		padding: 0.6rem 0.8rem;
		color-scheme: dark;
		transition: border-color 0.18s ease, box-shadow 0.18s ease;
	}

	input::placeholder {
		color: rgba(255, 255, 255, 0.4);
	}

	input:focus {
		outline: none;
		border-color: rgba(34, 197, 94, 0.6);
		box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25);
	}

	.enter-btn {
		font: inherit;
		cursor: pointer;
		padding: 0.6rem 1.1rem;
		color: #fff;
		background: rgba(34, 197, 94, 0.22);
		border: 1px solid rgba(34, 197, 94, 0.5);
		border-radius: 10px;
		transition: background 0.18s ease, border-color 0.18s ease;
	}

	.enter-btn:hover {
		background: rgba(34, 197, 94, 0.32);
		border-color: rgba(34, 197, 94, 0.7);
	}

	.error {
		margin: 0;
		color: #fca5a5;
		font-size: 0.85rem;
	}

	.back {
		display: inline-block;
		margin-top: 1.1rem;
		font-size: 0.82rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.55);
		text-decoration: none;
		transition: color 0.18s ease;
	}

	.back:hover {
		color: rgba(255, 255, 255, 0.9);
	}
</style>
