<script lang="ts">
	import '@fontsource/roboto/700.css';
	import 'flag-icons/css/flag-icons.min.css';
	import type { Snippet } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import TopNav from '$lib/TopNav.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<TopNav isAdmin={data.isAdmin} />
<main>
	<div class="work-scroll">
		{@render children()}
	</div>
</main>

<style>
	:global(:root) {
		--topnav-height: 64px;
	}

	:global(html, body) {
		margin: 0;
		padding: 0;
		height: 100%;
	}
	:global(body) {
		min-height: 100vh;
		background: linear-gradient(135deg, #15803d 0%, #052e16 100%);
		background-attachment: fixed;
		color: rgba(255, 255, 255, 0.95);
		font-family: 'Roboto', sans-serif;
		font-weight: 700;
	}

	/* Scrollbars custom — finas y claras sobre el fondo oscuro. */
	:global(*) {
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.45) transparent;
	}
	:global(::-webkit-scrollbar) {
		width: 8px;
		height: 8px;
	}
	:global(::-webkit-scrollbar-track) {
		background: transparent;
	}
	:global(::-webkit-scrollbar-thumb) {
		background: rgba(255, 255, 255, 0.45);
		border-radius: 999px;
		border: 2px solid transparent;
		background-clip: padding-box;
		transition: background-color 0.18s ease;
	}
	:global(::-webkit-scrollbar-thumb:hover) {
		background: rgba(255, 255, 255, 0.65);
		background-clip: padding-box;
	}
	:global(::-webkit-scrollbar-thumb:active) {
		background: rgba(255, 255, 255, 0.85);
		background-clip: padding-box;
	}
	:global(::-webkit-scrollbar-corner) {
		background: transparent;
	}

	/* Panel principal glass — mismo lenguaje que las barras. */
	/* Panel principal glass — ahora a todo el ancho (sin barra lateral). */
	main {
		position: fixed;
		top: calc(2rem + var(--topnav-height));
		left: 1rem;
		right: 1rem;
		bottom: 1rem;
		box-sizing: border-box;
		background: rgba(255, 255, 255, 0.012);
		backdrop-filter: blur(8px) saturate(110%);
		-webkit-backdrop-filter: blur(8px) saturate(110%);
		border: 1px solid #fff;
		border-radius: 16px;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.08),
			0 4px 16px rgba(0, 0, 0, 0.12);
		overflow: hidden;
	}

	.work-scroll {
		position: absolute;
		top: 16px;
		bottom: 16px;
		left: 0;
		right: 0;
		overflow-y: auto;
		overflow-x: hidden;
	}
</style>
