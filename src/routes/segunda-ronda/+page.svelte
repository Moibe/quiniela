<script lang="ts">
	import { Swords } from '@lucide/svelte';
</script>

<section class="segunda">
	<div class="placeholder">
		<Swords size={42} strokeWidth={1.6} aria-hidden="true" />
		<p class="titulo">Segunda Ronda</p>
		<p class="msg">La fase eliminatoria del Mundial irá aquí.</p>
	</div>
</section>

<style>
	.segunda {
		display: flex;
		height: 100%;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		box-sizing: border-box;
		color: rgba(255, 255, 255, 0.95);
	}

	.placeholder {
		text-align: center;
		color: rgba(255, 255, 255, 0.55);
	}

	.placeholder :global(svg) {
		color: rgba(255, 255, 255, 0.4);
		margin-bottom: 0.75rem;
	}

	.titulo {
		margin: 0 0 0.3rem;
		font-size: 1.1rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.85);
	}

	.msg {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 400;
	}
</style>
