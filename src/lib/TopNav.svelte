<script lang="ts">
  import {
    Trophy,
    Users,
    Radio,
    Newspaper,
    LayoutGrid,
    Swords,
    ChartPie,
    LogOut
  } from '@lucide/svelte';
  import { enhance } from '$app/forms';
  import { page } from '$app/state';

  let { isAdmin = false }: { isAdmin?: boolean } = $props();

  // Ruta actual para volver aquí tras login/logout.
  const redirectTo = $derived(encodeURIComponent(page.url.pathname));

  // Efecto tilt 3D (idéntico a estudio-cine): la barra reacciona al mover el
  // mouse con una rotación sutil de ±1.2° en perspectiva.
  let tiltX = $state(0);
  let tiltY = $state(0);

  function handleMove(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    const MAX = 1.2;
    tiltX = -ny * MAX;
    tiltY = nx * MAX;
  }

  function handleLeave() {
    tiltX = 0;
    tiltY = 0;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions: efecto tilt visual; no es interacción funcional -->
<header
  class="topnav"
  style="transform: perspective(900px) rotateX({tiltX}deg) rotateY({tiltY}deg);"
  onmousemove={handleMove}
  onmouseleave={handleLeave}
>
  <a href="/" class="brand" aria-label="Inicio">
    <Trophy size={26} strokeWidth={2} aria-hidden="true" />
    <span class="brand-title">Quiniela</span>
  </a>

  <nav class="topnav-nav">
    <a
      href="/en-vivo"
      class="nav-item nav-vivo"
      aria-current={page.url.pathname === '/en-vivo' ? 'page' : undefined}
    >
      <Radio size={16} strokeWidth={2.2} aria-hidden="true" />
      <span>En Vivo</span>
    </a>
    <a href="/" class="nav-item" aria-current={page.url.pathname === '/' ? 'page' : undefined}>
      <Users size={16} strokeWidth={2.2} aria-hidden="true" />
      <span>Participantes</span>
    </a>
    <a
      href="/partidos"
      class="nav-item"
      aria-current={page.url.pathname === '/partidos' ? 'page' : undefined}
    >
      <Newspaper size={16} strokeWidth={2.2} aria-hidden="true" />
      <span>Partidos</span>
    </a>
    <a
      href="/lugares"
      class="nav-item"
      aria-current={page.url.pathname === '/lugares' ? 'page' : undefined}
    >
      <Trophy size={16} strokeWidth={2.2} aria-hidden="true" />
      <span>Lugares</span>
    </a>
    <a
      href="/estadisticas"
      class="nav-item"
      aria-current={page.url.pathname === '/estadisticas' ? 'page' : undefined}
    >
      <ChartPie size={16} strokeWidth={2.2} aria-hidden="true" />
      <span>Estadísticas</span>
    </a>
    <a
      href="/grupos"
      class="nav-item"
      aria-current={page.url.pathname === '/grupos' ? 'page' : undefined}
    >
      <LayoutGrid size={16} strokeWidth={2.2} aria-hidden="true" />
      <span>Grupos</span>
    </a>
    <a
      href="/segunda-ronda"
      class="nav-item"
      aria-current={page.url.pathname === '/segunda-ronda' ? 'page' : undefined}
    >
      <Swords size={16} strokeWidth={2.2} aria-hidden="true" />
      <span>Segunda Ronda</span>
    </a>
  </nav>

  <div class="spacer"></div>

  {#if isAdmin}
    <span class="admin-chip" title="Tienes sesión de administrador">
      <span class="dot" aria-hidden="true"></span>
      Admin
    </span>
    <form method="POST" action="/acceso?/logout&redirectTo={redirectTo}" use:enhance class="sesion-form">
      <button type="submit" class="topnav-btn" title="Cerrar sesión de admin">
        <LogOut size={15} strokeWidth={2} aria-hidden="true" />
        <span>Salir</span>
      </button>
    </form>
  {/if}
</header>

<style>
  .topnav {
    position: fixed;
    top: 1rem;
    left: 1rem;
    right: 1rem;
    height: var(--topnav-height, 64px);
    padding: 0 1.25rem;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.012);
    backdrop-filter: blur(8px) saturate(110%);
    -webkit-backdrop-filter: blur(8px) saturate(110%);
    border: 1px solid #fff;
    border-radius: 16px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 4px 16px rgba(0, 0, 0, 0.12);
    transition: transform 0.18s ease-out;
    will-change: transform;
    user-select: none;
    z-index: 9;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    color: rgba(255, 255, 255, 0.98);
    text-decoration: none;
    border-radius: 8px;
    padding: 0.25rem 0.4rem;
    transition: background 0.18s ease;
  }

  .brand:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .brand-title {
    font-size: 1.2rem;
    letter-spacing: 0.005em;
    text-shadow:
      0 0 10px rgba(255, 255, 255, 0.28),
      0 0 24px rgba(255, 255, 255, 0.14);
  }

  .spacer {
    flex: 1;
  }

  /* Navegación principal (antes en la barra lateral). */
  .topnav-nav {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin-left: 1.25rem;
    padding-left: 1.25rem;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
  }

  .nav-item {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.45rem 0.8rem;
    color: rgba(255, 255, 255, 0.88);
    text-decoration: none;
    font-size: 0.9rem;
    border-radius: 8px;
    border: 1px solid transparent;
    text-shadow:
      0 0 8px rgba(255, 255, 255, 0.18),
      0 0 18px rgba(255, 255, 255, 0.08);
    transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
    white-space: nowrap;
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.09);
    border-color: rgba(255, 255, 255, 0.16);
    color: #fff;
  }

  .nav-item[aria-current='page'] {
    color: #fff;
    background: rgba(37, 99, 235, 0.18);
    border-color: rgba(37, 99, 235, 0.45);
    box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.18) inset;
  }

  /* En Vivo: acento rojo tenue para que se sienta "en vivo". */
  .nav-vivo {
    color: #fca5a5;
  }

  .nav-vivo:hover {
    color: #fecaca;
  }

  /* En pantallas chicas: solo íconos (texto oculto) para que no se desborde.
     También ocultamos el título "Quiniela" (queda la copita como botón de
     inicio) y apretamos el padding, para que quepan todos los íconos de la
     nav —incluido Segunda Ronda— sin salirse del borde. */
  @media (max-width: 680px) {
    .topnav {
      padding: 0 0.6rem;
    }
    .brand {
      gap: 0;
      padding: 0.25rem;
    }
    .brand-title {
      display: none;
    }
    .topnav-nav {
      margin-left: 0.5rem;
      padding-left: 0.5rem;
      gap: 0.1rem;
    }
    .nav-item {
      padding: 0.45rem 0.5rem;
    }
    .nav-item span,
    .topnav-btn span {
      display: none;
    }
  }

  /* Teléfonos muy angostos (≤360px): apretamos aún más y achicamos la copita
     para que el último ícono (Segunda Ronda) no se recorte. */
  @media (max-width: 360px) {
    .topnav {
      padding: 0 0.4rem;
    }
    .brand :global(svg) {
      width: 22px;
      height: 22px;
    }
    .topnav-nav {
      margin-left: 0.35rem;
      padding-left: 0.35rem;
    }
    .nav-item {
      padding: 0.45rem 0.35rem;
    }
  }

  /* Chip de sesión de admin. */
  .admin-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-right: 0.6rem;
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #86efac;
    background: rgba(34, 197, 94, 0.16);
    border: 1px solid rgba(34, 197, 94, 0.45);
    border-radius: 999px;
  }

  .admin-chip .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.8);
  }

  .sesion-form {
    margin: 0;
  }

  /* Botón glass del navbar (Entrar / Salir). */
  .topnav-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.8rem;
    color: rgba(255, 255, 255, 0.85);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 10px;
    cursor: pointer;
    text-decoration: none;
    font: inherit;
    font-size: 0.85rem;
    transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
  }

  .topnav-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.22);
  }
</style>
