import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// Mismo puerto que en el droplet (pm2 en 127.0.0.1:3000 detrás de nginx, noxoroxo.com), para
	// que local y prod coincidan. strictPort: si está ocupado, falla en vez de saltar a otro puerto.
	server: { port: 3000, strictPort: true },
	preview: { port: 3000, strictPort: true }
});
