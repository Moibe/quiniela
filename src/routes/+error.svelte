<script lang="ts">
	import { page } from '$app/state';

	// 404 → mensaje propio en español; otros errores → el mensaje que venga.
	const mensaje = $derived(
		page.status === 404 ? 'Página no existe' : (page.error?.message ?? 'Algo salió mal')
	);
</script>

<section class="error">
	<h1 class="code">{page.status}</h1>
	<p class="msg">{mensaje}</p>
	<a class="volver" href="/">← Volver al inicio</a>
</section>

<style>
	.error {
		box-sizing: border-box;
		padding: 1.75rem 2.5rem;
		color: rgba(255, 255, 255, 0.95);
	}

	.code {
		margin: 0 0 0.4rem;
		font-size: 2.4rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		text-shadow: 0 0 18px rgba(255, 255, 255, 0.18);
	}

	.msg {
		margin: 0 0 1.25rem;
		font-size: 1rem;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.7);
	}

	.volver {
		display: inline-block;
		font-size: 0.9rem;
		color: #86efac;
		text-decoration: none;
		padding: 0.3rem 0;
		border-bottom: 1px solid transparent;
		transition: border-color 0.18s ease;
	}

	.volver:hover {
		border-bottom-color: #86efac;
	}
</style>
