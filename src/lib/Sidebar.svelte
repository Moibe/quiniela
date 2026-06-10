<script lang="ts">
  import { page } from '$app/state';
  import {
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    ChevronDown,
    Users,
    Newspaper,
    Trophy
  } from '@lucide/svelte';

  type Orientation = 'vertical' | 'horizontal';

  let {
    orientation = 'vertical',
    collapsed = false,
    toggleCollapsed
  }: {
    orientation?: Orientation;
    collapsed?: boolean;
    toggleCollapsed: () => void;
  } = $props();

  // Efecto tilt 3D — igual que el TopNav.
  let tiltX = $state(0);
  let tiltY = $state(0);
  let sidebarWidth = $state(240);

  // Publica el ancho real de la barra como variable CSS para que el <main>
  // del layout se recorra exactamente lo necesario.
  $effect(() => {
    if (typeof document === 'undefined' || orientation !== 'vertical') return;
    // Publica siempre: ancho real cuando está expandida, 0 al replegar. Así el
    // offset del <main> nunca queda con un ancho obsoleto en el frame de revelado.
    document.documentElement.style.setProperty(
      '--sidebar-width',
      collapsed ? '0px' : `${sidebarWidth}px`
    );
  });

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

  function handleCollapseClick(e: MouseEvent) {
    e.stopPropagation();
    tiltX = 0;
    tiltY = 0;
    toggleCollapsed();
  }
</script>

{#if !collapsed}
  <!-- svelte-ignore a11y_no_static_element_interactions: efecto tilt visual -->
  <aside
    class="sidebar {orientation}"
    style="transform: perspective(900px) rotateX({tiltX}deg) rotateY({tiltY}deg);"
    bind:clientWidth={sidebarWidth}
    onmousemove={handleMove}
    onmouseleave={handleLeave}
  >
    <nav>
      <a
        href="/"
        class="nav-item"
        aria-current={page.url.pathname === '/' ? 'page' : undefined}
      >
        <Users size={16} strokeWidth={2.2} />
        <span>Participantes</span>
      </a>
      <a
        href="/resultados"
        class="nav-item"
        aria-current={page.url.pathname === '/resultados' ? 'page' : undefined}
      >
        <Newspaper size={16} strokeWidth={2.2} />
        <span>Resultados</span>
      </a>
      <a
        href="/posiciones"
        class="nav-item"
        aria-current={page.url.pathname === '/posiciones' ? 'page' : undefined}
      >
        <Trophy size={16} strokeWidth={2.2} />
        <span>Posiciones</span>
      </a>
    </nav>

    <div class="sidebar-footer">
      <button
        type="button"
        class="collapse-btn"
        onclick={handleCollapseClick}
        aria-label="Replegar barra"
      >
        {#if orientation === 'vertical'}
          <ChevronLeft size={18} strokeWidth={2.2} />
        {:else}
          <ChevronUp size={18} strokeWidth={2.2} />
        {/if}
      </button>
    </div>
  </aside>
{:else}
  <button
    type="button"
    class="reveal-handle {orientation}"
    onclick={toggleCollapsed}
    aria-label="Mostrar barra"
  >
    {#if orientation === 'vertical'}
      <ChevronRight size={18} strokeWidth={2.2} />
    {:else}
      <ChevronDown size={18} strokeWidth={2.2} />
    {/if}
  </button>
{/if}

<style>
  .sidebar {
    position: fixed;
    box-sizing: border-box;
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
  }

  .sidebar.vertical {
    top: calc(2rem + var(--topnav-height, 64px));
    left: 1rem;
    bottom: 1rem;
    width: max-content;
    min-width: 240px;
    max-width: 380px;
    padding: 1.5rem 1rem;
    display: flex;
    flex-direction: column;
  }

  .sidebar.horizontal {
    top: 1rem;
    left: 1rem;
    right: 1rem;
    height: 56px;
    padding: 0 1.25rem;
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  nav {
    display: flex;
    gap: 0.4rem;
  }

  .sidebar.vertical nav {
    flex-direction: column;
    /* Scroll con rueda pero scrollbar oculta; flex:1 + min-height:0 deja al
       nav ocupar el espacio entre el tope y el footer. */
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .sidebar.vertical nav::-webkit-scrollbar {
    display: none;
  }

  .sidebar.horizontal nav {
    flex-direction: row;
    align-items: center;
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: rgba(255, 255, 255, 0.92);
    text-decoration: none;
    font-size: 0.95rem;
    letter-spacing: 0.01em;
    border-radius: 8px;
    border: 1px solid transparent;
    text-shadow:
      0 0 8px rgba(255, 255, 255, 0.22),
      0 0 18px rgba(255, 255, 255, 0.1);
    transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }

  .sidebar.vertical .nav-item {
    padding: 0.7rem 0.95rem;
  }

  .sidebar.horizontal .nav-item {
    padding: 0.4rem 0.95rem;
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.09);
    border-color: rgba(255, 255, 255, 0.16);
  }

  .nav-item[aria-current='page'] {
    color: #fff;
    background: rgba(37, 99, 235, 0.18);
    border-color: rgba(37, 99, 235, 0.45);
    box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.18) inset;
  }

  .sidebar-footer {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sidebar.vertical .sidebar-footer {
    margin-top: auto;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .sidebar.horizontal .sidebar-footer {
    margin-left: auto;
    height: 60%;
    padding-left: 1.25rem;
    border-left: 1px solid rgba(255, 255, 255, 0.08);
  }

  .collapse-btn,
  .reveal-handle {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 8px;
    padding: 0.4rem 0.5rem;
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font: inherit;
    transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
  }

  .collapse-btn:hover,
  .reveal-handle:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.24);
    color: #fff;
  }

  .reveal-handle {
    position: fixed;
    background: rgba(255, 255, 255, 0.012);
    backdrop-filter: blur(8px) saturate(110%);
    -webkit-backdrop-filter: blur(8px) saturate(110%);
    border: 1px solid #fff;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 4px 16px rgba(0, 0, 0, 0.12);
    padding: 0.55rem 0.45rem;
    z-index: 10;
  }

  .reveal-handle.vertical {
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
  }

  .reveal-handle.horizontal {
    top: 0.75rem;
    left: 50%;
    transform: translateX(-50%);
  }
</style>
