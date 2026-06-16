# HANDOFF — Labs: marcadores en vivo (lado quiniela)

Para un agente que trabaja en **quiniela** (este repo). Léelo completo antes de tocar nada.

## Objetivo

En `/labs` (área admin) construir: (1) un control para **asignar a cada partido su URL
de Cloudbet** y prender/apagar su monitoreo, y (2) un **display de los marcadores en vivo**
que se van capturando. quiniela **NO captura** los marcadores (no puede — ver Restricción);
solo **los guarda en su BD y los muestra**. La captura la hace un **runner externo** que
corre en la máquina local del usuario y empuja los goles a esta app.

## ⛔ Restricción CRÍTICA (no negociable)

quiniela se despliega en un droplet de DigitalOcean que está **geo-bloqueado por Cloudbet**
(HTTP 403, "Unavailable in your region"). Además, **importar `@moibe/partido-nucleo` o
`playwright-core` en quiniela ROMPE el build** (`ReferenceError: __dirname is not defined in
ES module scope` — playwright-core se bundlea mal en ESM con vite ≥8.0.16).

→ **quiniela debe quedar 100% PLAYWRIGHT-FREE.**
- NUNCA importes `@moibe/partido-nucleo` (ni runtime ni `import type`) ni `playwright-core`.
- NO intentes leer Cloudbet desde quiniela.
- Si existen endpoints `src/routes/api/labs/monitor/*` (importan el paquete), **bórralos** —
  rompen el deploy. (Ya se removieron en una edición local; confirma que no estén.)

## Cómo funciona el sistema completo (contexto)

```
   RUNNER LOCAL (máquina del usuario, región OK)        QUINIELA (droplet, geo-bloqueado)
   ┌───────────────────────────────────────┐           ┌──────────────────────────────────┐
   │ lee Cloudbet con el paquete            │  GET      │ /api/monitor/targets  (qué vigilar)│
   │  • pregunta qué vigilar  ◄─────────────┼───────────┤ /api/monitor/score    (ingest goles)│ ─► tabla `partidos`
   │  • empuja goles ───────────────────────┼──POST────►│ /labs  (control + display)         │
   └───────────────────────────────────────┘           └──────────────────────────────────┘
```

El runner vive en **este repo**: `scripts/monitor-runner.mjs` (`npm run monitor`), migrado
desde el viejo `partido-tiempo-real` (deprecado). **No es parte del build** (vite solo bundlea
`src/`); importa `@moibe/partido-nucleo` solo ahí (jamás desde `src/`). Mantén el **contrato**
de los endpoints que consume y la UI de `/labs`.

## Estado actual en quiniela (YA HECHO — no rehacer)

- **Schema** (`src/lib/server/db/schema.ts`), tabla `partidos`, ya tiene:
  - `urlCloudbet: text('url_cloudbet')` (nullable) — URL del partido en Cloudbet.
  - `monitorear: integer('monitorear', { mode: 'boolean' }).notNull().default(false)`.
  - Migración `drizzle/0003_monitor_cloudbet.sql` (aditiva) — **ya aplicada en prod**.
- **`GET /api/monitor/targets/+server.ts`** — devuelve los partidos con `monitorear=true` y
  `urlCloudbet` no nulo: `[{ partidoId, numero, equipoA, equipoB, url }]`. Auth: header
  `x-monitor-secret` == env `MONITOR_SECRET`.
- **`POST /api/monitor/score/+server.ts`** — body `{ partidoId, golesA, golesB, final? }`;
  hace `db.update(partidos).set({ golesA, golesB, fecha: new Date(), enCurso: !final })`. Auth:
  mismo `x-monitor-secret`. **Estos dos endpoints NO los toques** salvo para mejorarlos sin
  romper el contrato (el runner depende de ellos).
- **`.env.example`** tiene `MONITOR_SECRET=`. Es un secreto que el usuario **inventa**
  (string aleatorio fuerte), **idéntico** en quiniela y en el runner; autentica `/api/monitor/*`.
  Generarlo y ponerlo en el `.env` real del droplet (una sola vez; el `.env` no está en git):
  ```bash
  SECRET=$(openssl rand -hex 32)
  printf "\nMONITOR_SECRET=%s\n" "$SECRET" >> ~/code/quiniela/.env
  echo "$SECRET"                                   # cópialo: el runner usa el MISMO valor
  cd ~/code/quiniela && pm2 restart quiniela --update-env
  ```
  Sin él (o si no coincide con el del runner) los endpoints responden **401**.
- **`/labs`** (`src/routes/labs/`): placeholder, admin-gated (`load` hace `error(404)` si
  `!locals.isAdmin`). `TopNav.svelte` ya tiene el link "Labs" (solo admin).

## Lo que hay que construir (TU trabajo)

### 1. Asignar URL + activar monitoreo por partido (admin)
- Nuevo endpoint **`POST /api/monitor/target/+server.ts`** (admin-gated con `locals.isAdmin`,
  **sin** secret — es UI admin, no el runner): body `{ partidoId, urlCloudbet, monitorear }`;
  valida; `db.update(partidos).set({ urlCloudbet, monitorear }).where(eq(partidos.id, partidoId))`.
- En `/labs`: lista de partidos (los 72, o filtrable) con, por fila: input para pegar la
  **URL de Cloudbet** + toggle **"monitorear"** → guarda vía ese endpoint (form action o fetch).

### 2. Display de marcadores en vivo (desde la BD)
- En `/labs`, sección que muestra los partidos con `monitorear=true`:
  `equipoA  golesA : golesB  equipoB`, + estado (`enCurso=true` → "en vivo"; con goles y
  `enCurso=false` → "final"; goles null → "—"). Refrescar cada ~5–10 s.
- Para refrescar, lo más simple: un **`GET /api/monitor/estado/+server.ts`** (admin) que
  devuelva los partidos monitoreados con su marcador actual, y el front lo pollea con
  `setInterval` + `fetch`. (Los goles los actualiza el runner vía `/api/monitor/score`; tú
  solo LEES `partidos` de la BD.)

### 3. Recuadro de instrucciones del runner (estático, en `/labs`)
La página **no puede** arrancar el runner (corre en la máquina local del usuario; el navegador
no puede lanzar procesos + el droplet está geo-bloqueado). Pero sí debe **mostrar las
instrucciones**: un `.bloque` estático con un texto breve ("la captura corre en tu máquina…")
y el comando listo para copiar (con botón "copiar" → `navigator.clipboard.writeText`):
```
cd C:\Moibe\code\quiniela ; npm run monitor
```
+ nota de que requiere las variables persistidas una vez (`MONITOR_SECRET`,
`PARTIDO_NAVEGADOR_MODO=lanzar`, `PARTIDO_CHROME_PATH`). Es solo texto/UI, sin lógica.

## Convenciones del proyecto (síguelas)

- **SvelteKit 5** (runes: `$state`/`$props`/`$derived`/`$effect`), `adapter-node`, SQLite + Drizzle.
- DB: `import { db } from '$lib/server/db';` · `import { partidos } from '$lib/server/db/schema';`
  · `import { eq, and, isNotNull } from 'drizzle-orm';`
- Env: `import { env } from '$env/dynamic/private';` (p. ej. `env.MONITOR_SECRET`).
- Endpoints: `import { error, json } from '@sveltejs/kit';` · `import type { RequestHandler } from './$types';`
- **Admin gating:** en endpoints `if (!locals.isAdmin) error(403, '…')`; en `+page.server.ts`
  `load`: `if (!locals.isAdmin) error(404, 'Página no existe')` (mira `src/routes/labs/+page.server.ts`).
- El marcador "en vivo" usa **`enCurso=true`** — patrón que YA existe en
  `src/routes/partidos/+page.server.ts` (`guardarMarcador`, action `setPartial`). `golesA/golesB`
  null = sin jugar. **Ese marcador ya cuenta para puntos/posiciones**, así que monitorear =
  escribir el marcador real del partido (no es un sandbox aparte): tenlo presente.
- **Mapeo de equipos:** `equipoA` del partido debe corresponder al equipo **local/home** de
  Cloudbet (lo asigna el usuario al pegar la URL). Si los goles salen invertidos, es esto.

## Testing / verificación

- quiniela **sola no captura nada** (no tiene Chrome). Para ver datos en el display:
  - el runner local debe estar corriendo y empujando, **o**
  - inserta goles a mano: `POST /api/monitor/score` con header `x-monitor-secret: <MONITOR_SECRET>`
    y body `{ "partidoId": N, "golesA": 1, "golesB": 0 }`.
- **`npm run build` DEBE pasar limpio.** Si ves `__dirname is not defined` o algo de
  playwright/chromium, se coló un import del paquete → quítalo. quiniela debe quedar playwright-free.
- `npm run check` (svelte-check) en 0 errores.
- Deploy: push a `main` dispara el GitHub Action (SSH al droplet → `git pull` + `npm ci` +
  `db:migrate` + `build` + `pm2 restart quiniela`). El `.env` del droplet necesita `MONITOR_SECRET`.

## Resumen de NO-HACER

- ❌ NO importar `@moibe/partido-nucleo` ni `playwright-core` en quiniela.
- ❌ NO leer Cloudbet desde quiniela (geo-block).
- ❌ NO romper el contrato de `/api/monitor/targets` ni `/api/monitor/score` (los usa el runner).
