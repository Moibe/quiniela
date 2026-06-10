<script lang="ts">
	import { codigoBandera } from '$lib/flags';

	let { equipo }: { equipo: string } = $props();

	const code = $derived(codigoBandera(equipo));
</script>

{#if code}
	<span class="bandera fi fi-{code}" title={equipo} aria-hidden="true"></span>
{/if}

<style>
	.bandera {
		flex-shrink: 0;
		border-radius: 2px;
		/* Borde sutil para que las banderas claras no se pierdan sobre el verde. */
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25);
	}
</style>
