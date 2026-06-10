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

	/* Scrollbars custom — más anchos, visibles y manejables, pero elegantes:
	   pastilla redondeada dentro de un carril sutil sobre el fondo verde. */
	:global(*) {
		scrollbar-width: auto;
		scrollbar-color: rgba(255, 255, 255, 0.55) rgba(255, 255, 255, 0.1);
	}
	:global(::-webkit-scrollbar) {
		width: 14px;
		height: 14px;
	}
	:global(::-webkit-scrollbar-track) {
		background: rgba(255, 255, 255, 0.07);
		border-radius: 999px;
	}
	:global(::-webkit-scrollbar-thumb) {
		background: rgba(255, 255, 255, 0.55);
		border-radius: 999px;
		border: 3px solid transparent;
		background-clip: padding-box;
		transition: background-color 0.18s ease;
	}
	:global(::-webkit-scrollbar-thumb:hover) {
		background: rgba(255, 255, 255, 0.78);
		background-clip: padding-box;
	}
	:global(::-webkit-scrollbar-thumb:active) {
		background: rgba(255, 255, 255, 0.92);
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
