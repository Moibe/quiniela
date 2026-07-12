import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// Puerto fijo para que la app siempre cargue en la misma URL (http://localhost:2026 — el año del
	// Mundial). strictPort: si está ocupado, falla en vez de saltar a otro puerto silenciosamente.
	server: { port: 2026, strictPort: true },
	preview: { port: 2026, strictPort: true }
});
