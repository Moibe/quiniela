# DEPLOY — Quiniela del Mundial → `noxoroxo.com` (Droplet gradioFish)

Handoff para ejecutar el despliegue. Pensado para que lo corra **Claude Code en la
terminal** (tiene la llave SSH funcionando vía agente + el `doctl` autenticado) o
el usuario a mano. Cada bloque es copy-paste.

## Contexto

- **App**: SvelteKit + SQLite (Drizzle), `adapter-node`. Repo: `git@github.com:Moibe/quiniela.git` (rama `main`, privado).
- **Droplet**: `gradioFish` — IP `165.22.53.200`, Ubuntu 24.10, usuario `root`. Corre varios Gradios bajo **pm2**, con **nginx** enrutando (configs en el repo hermano `nx-routes`, que se auto-despliega por GitHub Action al hacer push a `main`).
- **Objetivo**: la quiniela será la **cara principal** de `noxoroxo.com` (apex), corriendo en `127.0.0.1:3000` bajo pm2. La portada estática anterior se mueve a `/portada`. Los demos Gradio (`/superheroes/`, `/fortnite/`, etc.) **no se tocan**.
- **DNS/SSL**: `noxoroxo.com` (apex + www) ya apunta a `165.22.53.200` y ya tiene cert de Certbot válido → **NO hay que tocar DNS ni emitir cert nuevo**.

## Prerrequisitos (en la terminal que ejecuta esto)

1. Llave SSH cargada en el agente (si no, `ssh` no-interactivo falla):
   ```bash
   ssh-add        # teclea el passphrase una vez
   ssh -o BatchMode=yes root@165.22.53.200 'echo OK conexión'   # debe imprimir: OK conexión
   ```
2. `doctl` autenticado (ya lo está): `doctl account get` debe responder.

---

## PARTE A — Desplegar la app en el Droplet (SSH)

> ⚠️ **Orden crítico**: termina TODA la parte A (la quiniela viva en `:3000`) **antes** de tocar nginx (parte B). Si nginx apunta `/` a `:3000` y no hay nada ahí, `noxoroxo.com` da 502.

### A0. Recon (decide ramas)
```bash
ssh root@165.22.53.200 'echo "node:"; node -v; echo "npm:"; npm -v; echo "pm2:"; pm2 -v; \
  echo ":3000:"; (ss -tlnp 2>/dev/null||true)|grep -E ":3000\b" || echo libre; \
  echo "code dir:"; ls -d ~/code 2>/dev/null || echo "no ~/code"; \
  echo "tools:"; command -v make gcc g++ python3 | tr "\n" " "; echo'
```
- **Node** debe ser **≥ 18** (ideal ≥ 20). Si es menor: instalar Node 20 **vía `nvm`** (NO reemplazar el node del sistema, para no afectar el daemon de pm2 ni los Gradios) y correr build + pm2 con ese node (`--interpreter`).
- Si **`:3000` está OCUPADO**, elegir otro puerto libre (p.ej. 3001) y reemplazarlo en TODO este runbook (env `PORT` + el `proxy_pass` de la parte B).

### A1. Clonar el repo en `~/code`
```bash
ssh root@165.22.53.200 'cd ~/code && git clone git@github.com:Moibe/quiniela.git quiniela && cd quiniela && git log --oneline -1'
```
*(Si ya existía: `cd ~/code/quiniela && git pull origin main`.)*

### A2. Instalar dependencias
```bash
ssh root@165.22.53.200 'cd ~/code/quiniela && npm ci'
```
*(`better-sqlite3` debería traer binario prebuilt para Ubuntu x64 + tu Node. Si intenta compilar y falla por falta de toolchain: `apt-get install -y build-essential python3`.)*

### A3. Crear el `.env` de producción
> `.env` está en `.gitignore` (no viene en el repo). Hay que crearlo en el server.
> **Pon una contraseña FUERTE** (no `abc123`).
```bash
ssh root@165.22.53.200 'cat > ~/code/quiniela/.env <<EOF
DATABASE_URL=./local.db
ADMIN_PASSWORD=CAMBIA_ESTO_POR_ALGO_FUERTE
ORIGIN=https://noxoroxo.com
PORT=3000
HOST=127.0.0.1
EOF
echo ".env creado"'
```
- `ORIGIN=https://noxoroxo.com` es **clave**: hace que SvelteKit acepte el cookie `secure` del admin y pase el chequeo CSRF de las form actions detrás de nginx.
- `HOST=127.0.0.1` → solo accesible vía nginx (no expuesto directo).

### A4. Migrar + sembrar la base
> Exportamos el `.env` al shell para no depender de la versión de Node (`--env-file` necesita Node ≥ 20.6).
```bash
ssh root@165.22.53.200 'cd ~/code/quiniela && set -a && . ./.env && set +a && node scripts/migrate.mjs && node scripts/seed.mjs'
```
Debe imprimir `Migrations applied...` y `Seed OK → participantes: 29 | partidos: 72 | pronosticos: 2088`.

### A5. Build
```bash
ssh root@165.22.53.200 'cd ~/code/quiniela && npm run build'
```
Debe terminar con `Using @sveltejs/adapter-node ✔ done` y generar `build/`.

### A6. Arrancar con pm2
```bash
ssh root@165.22.53.200 'cd ~/code/quiniela && set -a && . ./.env && set +a && pm2 start build/index.js --name quiniela --update-env && pm2 save'
```
*(Node viejo vía nvm: añade `--interpreter "$HOME/.nvm/versions/node/vXX/bin/node"`.)*

### A7. Verificar que vive en :3000
```bash
ssh root@165.22.53.200 'curl -s -o /dev/null -w "http=%{http_code}\n" http://127.0.0.1:3000/ ; pm2 ls | grep quiniela'
```
Debe dar `http=200` y la app `online` en pm2. **Solo si esto sale bien, sigue a la parte B.**

---

## PARTE B — nginx: apex → quiniela, portada → /portada (vía `nx-routes`)

Esto se hace en el repo **`nx-routes`** (no por SSH directo): se edita el archivo, se
hace push a `main`, y la GitHub Action lo jala al Droplet y recarga nginx.

### B1. Reemplazar el contenido de `nx-routes/noxoroxo.com` por:
```nginx
server {
    server_name noxoroxo.com www.noxoroxo.com;

    # Forzar www → apex (para que ORIGIN=https://noxoroxo.com siempre cuadre)
    if ($host = www.noxoroxo.com) { return 301 https://noxoroxo.com$request_uri; }

    # Portada estática anterior (antes estaba en /)
    location = /portada {
        root /usr/share/nginx/html;
        try_files /noxoroxo.com.html =404;
    }

    # --- Demos Gradio: SIN CAMBIOS ---
    location /detecta-integra/ { proxy_pass http://127.0.0.1:7877/; proxy_buffering off; proxy_redirect off; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Forwarded-Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
    location /astroblend/     { proxy_pass http://127.0.0.1:7877/; proxy_buffering off; proxy_redirect off; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Forwarded-Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
    location /superheroes/    { proxy_pass http://127.0.0.1:7888/; proxy_buffering off; proxy_redirect off; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Forwarded-Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
    location /super/          { proxy_pass http://127.0.0.1:7889/; proxy_buffering off; proxy_redirect off; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Forwarded-Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
    location /fortnite/       { proxy_pass http://127.0.0.1:7899/; proxy_buffering off; proxy_redirect off; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Forwarded-Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
    location /sampler/        { proxy_pass http://127.0.0.1:7811/; proxy_buffering off; proxy_redirect off; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Forwarded-Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
    location /palette/        { proxy_pass http://127.0.0.1:7822/; proxy_buffering off; proxy_redirect off; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Forwarded-Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
    location /acuarela/       { proxy_pass http://127.0.0.1:7822/; proxy_buffering off; proxy_redirect off; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Forwarded-Host $host; proxy_set_header X-Forwarded-Proto $scheme; }
    location /observa/        { proxy_pass http://127.0.0.1:7833/; proxy_buffering off; proxy_redirect off; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; proxy_set_header X-Forwarded-Host $host; proxy_set_header X-Forwarded-Proto $scheme; }

    # --- Quiniela = cara principal ---
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/noxoroxo.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/noxoroxo.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
    client_max_body_size 12M;
}

server {
    if ($host = www.noxoroxo.com) { return 301 https://noxoroxo.com$request_uri; } # managed by Certbot
    if ($host = noxoroxo.com)     { return 301 https://$host$request_uri; } # managed by Certbot
    listen 80;
    server_name noxoroxo.com www.noxoroxo.com;
    return 404; # managed by Certbot
}
```

### B2. Commit + push de `nx-routes` (dispara el Action → recarga nginx)
```bash
cd <ruta-a>/nx-routes
git add noxoroxo.com && git commit -m "noxoroxo.com: quiniela en apex, portada -> /portada" && git push origin main
```

### B3. (Sanidad opcional, por SSH) probar config antes de confiar en el reload del Action:
```bash
ssh root@165.22.53.200 'nginx -t && systemctl reload nginx'
```

---

## Verificación final
```bash
curl -s -o /dev/null -w "noxoroxo.com -> %{http_code}\n" https://noxoroxo.com/
curl -s -o /dev/null -w "/portada    -> %{http_code}\n" https://noxoroxo.com/portada
curl -s -o /dev/null -w "/superheroes-> %{http_code}\n" https://noxoroxo.com/superheroes/
```
- `noxoroxo.com/` → 200 y debe verse la quiniela (Participantes).
- `/portada` → 200 (landing vieja).
- `/superheroes/` (y demás demos) → siguen respondiendo.
- Probar login admin: arriba a la derecha **🔒 Entrar como admin** → contraseña del `.env` de prod.

## Redespliegue futuro (cuando cambie el código)
```bash
ssh root@165.22.53.200 'cd ~/code/quiniela && git pull origin main && npm ci && set -a && . ./.env && set +a && (node scripts/migrate.mjs || true) && npm run build && pm2 restart quiniela --update-env'
```

## Rollback rápido
- App: `ssh root@165.22.53.200 'pm2 stop quiniela'` (los Gradios siguen; `noxoroxo.com/` daría 502 hasta revertir nginx).
- nginx: revertir el commit en `nx-routes` y push (el Action recarga la versión anterior).

## Gotchas
- **Orden**: app viva en `:3000` ANTES de tocar nginx (si no, 502).
- **Node < 18**: usar `nvm` (no tocar node del sistema → no romper pm2/Gradios).
- **Puerto 3000 ocupado**: cambiar `PORT` en `.env` y el `proxy_pass` en la parte B.
- **`ORIGIN`**: si lo dejas mal, el login admin falla (cookie/CSRF). Debe ser `https://noxoroxo.com`.
- **Contraseña**: usa una fuerte en el `.env` de prod; sin caracteres raros de shell (o entre comillas en el `.env`).
