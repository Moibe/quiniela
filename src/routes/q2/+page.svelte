<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Bandera from '$lib/Bandera.svelte';
	import { q2Participantes, q2Juegos, type Q2Juego } from '$lib/q2Data';
	import { puntosDe, PUNTOS_EXACTO, PUNTOS_RESULTADO, computeStandings } from '$lib/scoring';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const actionError = $derived(form && 'error' in form ? form : null);

	// Resultado EN VIVO/final de cada juego (manual persistido + overlay del monitor), por etiqueta
	// (J1…J5). Se refresca cada 10s para que los aciertos (rosa = resultado, guinda = marcador exacto)
	// se prendan/actualicen en vivo. El load solo siembra el primer pintado; a partir de ahí manda el
	// poll, por eso capturamos el valor inicial.
	// svelte-ignore state_referenced_locally
	let resultados = $state(data.resultados ?? []);
	const resPorJuego = $derived(new Map(resultados.map((r) => [r.etiqueta, r] as const)));

	// Prefill del panel de captura (solo admin): sale de data (SSR + tras guardar), NO del poll, para
	// que el marcador de 10s no borre lo que el admin está escribiendo. Se refresca al guardar.
	const resInicial = $derived(new Map((data.resultados ?? []).map((r) => [r.etiqueta, r] as const)));

	async function refrescar() {
		try {
			const res = await fetch('/api/q2');
			if (res.ok) resultados = (await res.json()).resultados ?? [];
		} catch {
			/* sin conexión: se mantiene lo último */
		}
	}

	onMount(() => {
		const id = setInterval(() => {
			if (document.visibilityState === 'visible') refrescar();
		}, 10_000);
		return () => clearInterval(id);
	});

	// Tras guardar/limpiar un resultado: re-corre el load (refresca data + prefill) SIN resetear el
	// <form> (los inputs usan value={...}), y refresca el coloreo al instante.
	const trasGuardar: SubmitFunction = () => async ({ update }) => {
		await update({ reset: false });
		await refrescar();
	};

	// Acierto de una celda contra el resultado en vivo del juego: 2 = marcador exacto (guinda),
	// 1 = resultado correcto (rosa), 0 = nada / sin resultado aún. Misma lógica que Participantes.
	function hitDe(p: Q2Juego['pronos'][number], etiqueta: string): 0 | 1 | 2 {
		const r = resPorJuego.get(etiqueta);
		if (!r || r.golesA == null || r.golesB == null || p[0] == null || p[1] == null) return 0;
		const pts = puntosDe({ golesA: p[0], golesB: p[1] }, { golesA: r.golesA, golesB: r.golesB });
		return pts === PUNTOS_EXACTO ? 2 : pts === PUNTOS_RESULTADO ? 1 : 0;
	}

	const enVivoJuego = (etiqueta: string) => resPorJuego.get(etiqueta)?.estado === 'vivo';

	// --- Posiciones de Q2 (subtab equivalente a Lugares) ---
	// Se calcula EN EL CLIENTE con computeStandings (mismo 3/1 que el resto de la app), sobre los
	// pronósticos de q2Data y los resultados EFECTIVOS (resPorJuego, ya con overlay del monitor). Así
	// la tabla de posiciones se actualiza en vivo con el poll, sin ida al server.
	const q2Standings = $derived.by(() => {
		const parts = q2Participantes.map((nombre, id) => ({ id, nombre }));
		const mats = q2Juegos.map((j, id) => {
			const r = resPorJuego.get(j.etiqueta);
			return { id, golesA: r?.golesA ?? null, golesB: r?.golesB ?? null };
		});
		const pros: { partidoId: number; participanteId: number; golesA: number; golesB: number }[] = [];
		q2Juegos.forEach((j, gid) => {
			j.pronos.forEach((p, pid) => {
				if (p[0] == null || p[1] == null) return; // pronóstico sin capturar → no cuenta
				pros.push({ partidoId: gid, participanteId: pid, golesA: p[0], golesB: p[1] });
			});
		});
		return computeStandings(parts, mats, pros);
	});
	const standings = $derived(q2Standings.standings);
	const jugados = $derived(q2Standings.partidosJugados);

	// Medallas por NIVEL de puntaje (no por rank): los empatados en puntos comparten medalla.
	const top3 = $derived(
		[...new Set(standings.map((s) => s.puntos))]
			.filter((p) => p > 0)
			.sort((a, b) => b - a)
			.slice(0, 3)
	);
	const esPodio = (puntos: number) => puntos > 0 && top3.includes(puntos);
	const medalla = (puntos: number) => {
		const i = puntos > 0 ? top3.indexOf(puntos) : -1;
		return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
	};
	// Dos columnas en desktop (1→mitad / resto); una sola tabla en móvil.
	const mitadPos = $derived(Math.ceil(standings.length / 2));
	const posIzq = $derived(standings.slice(0, mitadPos));
	const posDer = $derived(standings.slice(mitadPos));

	// --- Torneo (bracket de Q2, estilo Segunda Ronda) ---
	// Los juegos traen placeholders ("G J1" = ganador de J1, "P J2" = perdedor de J2, etc.). Aquí los
	// RESOLVEMOS a equipos reales conforme se capturan los marcadores, para que el cuadro se vaya
	// dibujando. Rondas por dependencia: J1/J2 → J3 → J4 → J5 (final).
	const juegoPorEtiqueta = new Map(q2Juegos.map((j) => [j.etiqueta, j] as const));
	const rePlace = /^([GP])\s?J(\d)$/i;

	// Lado ganador de un juego ('a' | 'b' | null si empate o sin jugar).
	function ladoGanador(et: string): 'a' | 'b' | null {
		const r = resPorJuego.get(et);
		if (!r || r.golesA == null || r.golesB == null || r.golesA === r.golesB) return null;
		return r.golesA > r.golesB ? 'a' : 'b';
	}
	// Resuelve una etiqueta de equipo: si es real la devuelve; si es "G Jn"/"P Jn" devuelve el equipo
	// ganador/perdedor de ese juego (recursivo), o null si todavía no se sabe.
	function resolverEquipo(label: string): string | null {
		const m = label.match(rePlace);
		if (!m) return label; // equipo real
		const et = 'J' + m[2];
		const j = juegoPorEtiqueta.get(et);
		const lado = ladoGanador(et);
		if (!j || !lado) return null;
		const quiereGanador = m[1].toUpperCase() === 'G';
		const objetivo = quiereGanador ? lado : lado === 'a' ? 'b' : 'a';
		return resolverEquipo(objetivo === 'a' ? j.equipoA : j.equipoB);
	}
	// Texto amable para un placeholder aún sin resolver: "Ganador J1" / "Perdedor J3".
	function textoPlaceholder(label: string): string {
		const m = label.match(rePlace);
		if (!m) return label;
		return (m[1].toUpperCase() === 'G' ? 'Ganador' : 'Perdedor') + ' J' + m[2];
	}
	const marcadorTorneo = (et: string) => {
		const r = resPorJuego.get(et);
		return r && r.golesA != null && r.golesB != null ? { a: r.golesA, b: r.golesB } : null;
	};

	// Resuelve un slot (G Jn / P Jn) al equipo según el PRONÓSTICO del participante i (recursivo): el
	// ganador/perdedor que ÉL declaró en ese juego. Empate en su pronóstico → null (no declaró).
	function equipoDeclarado(label: string, i: number): string | null {
		const m = label.match(rePlace);
		if (!m) return label; // equipo real
		const juego = juegoPorEtiqueta.get('J' + m[2]);
		const pr = juego?.pronos[i];
		if (!juego || !pr || pr[0] == null || pr[1] == null || pr[0] === pr[1]) return null;
		const ganaA = pr[0] > pr[1];
		const ladoA = m[1].toUpperCase() === 'G' ? ganaA : !ganaA;
		return equipoDeclarado(ladoA ? juego.equipoA : juego.equipoB, i);
	}
	// Banderas del participante i en la fila de un juego: una por cada slot PLACEHOLDER (J3=1; J4/J5=2),
	// con el equipo que resulta de SUS pronósticos. Los slots de equipo real no llevan bandera.
	function banderasParticipante(etiqueta: string, i: number): string[] {
		const juego = juegoPorEtiqueta.get(etiqueta);
		if (!juego) return [];
		const out: string[] = [];
		for (const label of [juego.equipoA, juego.equipoB]) {
			if (!rePlace.test(label)) continue;
			const t = equipoDeclarado(label, i);
			if (t) out.push(t);
		}
		return out;
	}

	// Mismas interacciones que Participantes: VARIAS columnas resaltadas (1 clic), UNA fijada (doble
	// clic), VARIAS filas marcadas (clic en la identidad del juego).
	let highlighted = $state<Set<number>>(new Set());
	let pinned = $state<number | null>(null);
	let clickTimer: ReturnType<typeof setTimeout> | null = null;

	function onColClick(i: number) {
		if (clickTimer !== null) {
			clearTimeout(clickTimer);
			clickTimer = null;
			return;
		}
		clickTimer = setTimeout(() => {
			clickTimer = null;
			const next = new Set(highlighted);
			if (next.has(i)) next.delete(i);
			else next.add(i);
			highlighted = next;
		}, 250);
	}

	function onColDblClick(i: number) {
		if (clickTimer !== null) {
			clearTimeout(clickTimer);
			clickTimer = null;
		}
		pinned = pinned === i ? null : i;
	}

	let filaMarcada = $state<Set<number>>(new Set());
	function toggleFila(n: number) {
		const next = new Set(filaMarcada);
		if (next.has(n)) next.delete(n);
		else next.add(n);
		filaMarcada = next;
	}

	const marcador = (p: Q2Juego['pronos'][number]) =>
		p[0] == null || p[1] == null ? '' : `${p[0]}-${p[1]}`;

	// --- Subtabs de la Q2 (cada sección vive en su propio subtab; nada permanece como header fijo) ---
	// Para agregar un subtab: una entrada más en SUBTABS + su bloque {:else if} en el markup.
	const SUBTABS = [
		{ id: 'torneo', label: 'Torneo' },
		{ id: 'captura', label: 'Partidos' },
		{ id: 'participantes', label: 'Participantes' },
		{ id: 'posiciones', label: 'Lugares' },
		{ id: 'lugaresN', label: 'Lugares N' }
	] as const;
	type SubtabId = (typeof SUBTABS)[number]['id'];
	let subtab = $state<SubtabId>('participantes');
	// Todos los subtabs son públicos (incluido "Partidos"); dentro de Partidos, solo la EDICIÓN de
	// resultados es de admin.
	const subtabsVisibles = SUBTABS;

	// Navegación por teclado del tablist (patrón WAI-ARIA tabs): ←/→ ciclan, Home/End saltan.
	function onTabKey(e: KeyboardEvent, i: number) {
		if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
		e.preventDefault();
		const last = subtabsVisibles.length - 1;
		let next = i;
		if (e.key === 'ArrowRight') next = i === last ? 0 : i + 1;
		else if (e.key === 'ArrowLeft') next = i === 0 ? last : i - 1;
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = last;
		subtab = subtabsVisibles[next].id;
		const tabs = (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('[role="tab"]');
		tabs?.[next]?.focus();
	}
</script>

{#snippet tablaPos(filas: typeof standings, lado: string)}
	<div class="pos-wrap">
		<table class="pos-table">
			<caption class="sr-only">Posiciones de Q2 ({lado}), ordenadas por puntos.</caption>
			<thead>
				<tr>
					<th scope="col" class="pc-pos">#</th>
					<th scope="col" class="pc-name">Participante</th>
					<th scope="col" class="pc-pts">Pts</th>
					<th scope="col" class="pc-n" title="Marcadores exactos (3 pts c/u)">Exactos</th>
					<th scope="col" class="pc-n" title="Resultados correctos (1 pt c/u)">Resultado</th>
				</tr>
			</thead>
			<tbody>
				{#each filas as s (s.participanteId)}
					<tr class:pos-podio={esPodio(s.puntos)}>
						<td class="pc-pos"
							><span class="pc-slot medal" aria-hidden="true">{medalla(s.puntos)}</span><span
								class="pc-slot rank">{s.rank}</span
							></td
						>
						<th scope="row" class="pc-name notranslate" translate="no">{s.nombre}</th>
						<td class="pc-pts">{s.puntos}</td>
						<td class="pc-n">{s.exactos}</td>
						<td class="pc-n">{s.resultados}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

{#snippet tMatch(et: string)}
	{@const j = juegoPorEtiqueta.get(et)}
	{#if j}
		{@const mc = marcadorTorneo(et)}
		{@const lg = ladoGanador(et)}
		{@const ra = resolverEquipo(j.equipoA)}
		{@const rb = resolverEquipo(j.equipoB)}
		<div class="t-match" class:t-jugado={!!mc} class:t-final={et === 'J5'}>
			{#if et === 'J5'}<span class="t-trofeo" aria-hidden="true">🏆</span>{/if}
			<span class="t-num">{et}</span>
			<div class="t-lado" class:t-gana={lg === 'a'}>
				{#if ra}
					<Bandera equipo={ra} />
					<span class="t-nm notranslate" translate="no" title={ra}>{ra}</span>
				{:else}
					<span class="t-ph">{textoPlaceholder(j.equipoA)}</span>
				{/if}
				<span class="t-g">{mc ? mc.a : '–'}</span>
			</div>
			<div class="t-lado" class:t-gana={lg === 'b'}>
				{#if rb}
					<Bandera equipo={rb} />
					<span class="t-nm notranslate" translate="no" title={rb}>{rb}</span>
				{:else}
					<span class="t-ph">{textoPlaceholder(j.equipoB)}</span>
				{/if}
				<span class="t-g">{mc ? mc.b : '–'}</span>
			</div>
		</div>
	{/if}
{/snippet}

<section class="q2">
	<div class="subtabs" role="tablist" aria-label="Secciones de la Quiniela 2">
		{#each subtabsVisibles as t, i (t.id)}
			<button
				id="subtab-{t.id}"
				class="subtab"
				class:active={subtab === t.id}
				role="tab"
				type="button"
				aria-selected={subtab === t.id}
				aria-controls="panel-{t.id}"
				tabindex={subtab === t.id ? 0 : -1}
				onclick={() => (subtab = t.id)}
				onkeydown={(e) => onTabKey(e, i)}
			>
				{t.label}
			</button>
		{/each}
	</div>

	{#if subtab === 'participantes'}
		<div id="panel-participantes" role="tabpanel" aria-labelledby="subtab-participantes" tabindex="0">
			<div class="top">
				<div class="head">
					<p class="sub">
						Quiniela 2 · Pronósticos de los {q2Participantes.length} participantes · {q2Juegos.length} juegos
					</p>
					<p class="hint">
						💡 Clic en participantes resalta sus columnas (varias a la vez; doble clic fija una) · clic en
						un juego (# o equipos) marca sus filas (varias a la vez).
					</p>
					<div class="leyenda" aria-hidden="true">
						<span class="leg"><span class="sw sw-res"></span> Resultado correcto</span>
						<span class="leg"><span class="sw sw-exa"></span> Marcador exacto</span>
						<span class="leg nota">se prenden con el resultado EN VIVO del monitor</span>
					</div>
				</div>
			</div>
			<div class="table-wrap">
				<table>
					<caption class="sr-only">
						Pronósticos de {q2Participantes.length} participantes para {q2Juegos.length} juegos de la Quiniela
						2. Filas: juegos. Columnas: participantes. Celdas: marcador pronosticado.
					</caption>
					<thead>
						<tr>
							<th scope="col" class="col-num">#</th>
							<th scope="col" class="col-team col-a">Equipo 1</th>
							<th scope="col" class="col-team col-b">Equipo 2</th>
							{#each q2Participantes as nombre, i (i)}
								<th
									scope="col"
									class="col-p notranslate"
									translate="no"
									class:highlighted={highlighted.has(i)}
									class:pinned={pinned === i}
									title="1 clic resalta · doble clic fija/suelta"
									onclick={() => onColClick(i)}
									ondblclick={() => onColDblClick(i)}
									>{#if pinned === i}<span class="pin" aria-hidden="true">📌</span>{/if}{nombre}</th
								>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each q2Juegos as j, ri (ri)}
							<tr class:fila-marcada={filaMarcada.has(ri)} class:envivo={enVivoJuego(j.etiqueta)}>
								<th
									scope="row"
									class="col-num fila-handle"
									title="Clic para marcar este juego"
									onclick={() => toggleFila(ri)}>{j.etiqueta}</th
								>
								<td class="col-team col-a fila-handle" onclick={() => toggleFila(ri)}>
									<div class="ti ti-a">
										<span class="tname notranslate" translate="no" title={j.equipoA}>{j.equipoA}</span>
										<Bandera equipo={j.equipoA} />
									</div>
								</td>
								<td class="col-team col-b fila-handle" onclick={() => toggleFila(ri)}>
									<div class="ti ti-b">
										<Bandera equipo={j.equipoB} />
										<span class="tname notranslate" translate="no" title={j.equipoB}>{j.equipoB}</span>
									</div>
								</td>
								{#each j.pronos as p, i (i)}
									{@const h = hitDe(p, j.etiqueta)}
									{@const flags = banderasParticipante(j.etiqueta, i)}
									<td
										class="prono"
										class:highlighted={highlighted.has(i)}
										class:pinned={pinned === i}
										class:hit-resultado={h === 1}
										class:hit-exacto={h === 2}
										>{#if flags.length}<span class="prono-flag">{marcador(p)}{#each flags as f, fi (fi)}<Bandera equipo={f} />{/each}</span>{:else}{marcador(p)}{/if}</td
									>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{:else if subtab === 'posiciones'}
		<div id="panel-posiciones" role="tabpanel" aria-labelledby="subtab-posiciones" tabindex="0">
			<div class="pos">
				<p class="pos-sub">
					3 pts por marcador exacto · 1 pt por resultado correcto ·
					<strong>{jugados}</strong> de {q2Juegos.length} juegos con resultado
				</p>
				{#if jugados === 0}
					<p class="pos-empty">
						Aún no hay resultados de Q2. La tabla se irá llenando conforme se capturen los marcadores.
					</p>
				{/if}
				<!-- Pantallas anchas: dos columnas (1→8 / 9→16). -->
				<div class="pos-cols-desktop">
					{@render tablaPos(posIzq, 'columna izquierda')}
					{@render tablaPos(posDer, 'columna derecha')}
				</div>
				<!-- Móvil / angosto: una sola tabla continua. -->
				<div class="pos-cols-mobile">
					{@render tablaPos(standings, 'tabla completa')}
				</div>
			</div>
		</div>
	{:else if subtab === 'lugaresN'}
		<div id="panel-lugaresN" role="tabpanel" aria-labelledby="subtab-lugaresN" tabindex="0">
			<div class="pos">
				<p class="pos-sub">
					3 pts por marcador exacto · 1 pt por resultado correcto ·
					<strong>{jugados}</strong> de {q2Juegos.length} juegos con resultado
				</p>
				{#if jugados === 0}
					<p class="pos-empty">
						Aún no hay resultados de Q2. La tabla se irá llenando conforme se capturen los marcadores.
					</p>
				{/if}
				<div class="pos-cols-desktop">
					{@render tablaPos(posIzq, 'columna izquierda')}
					{@render tablaPos(posDer, 'columna derecha')}
				</div>
				<div class="pos-cols-mobile">
					{@render tablaPos(standings, 'tabla completa')}
				</div>
			</div>
		</div>
	{:else if subtab === 'torneo'}
		<div id="panel-torneo" role="tabpanel" aria-labelledby="subtab-torneo" tabindex="0">
			<p class="t-sub">
				El cuadro de Q2: Cuartos → Semifinales → Final, más el partido por el 3er lugar. Los cruces
				se resuelven a equipos reales conforme se capturan los marcadores.
			</p>
			<div class="torneo-wrap">
				<div class="torneo-inner">
					<div class="br">
						<div class="br-col">
							<p class="t-ronda-tit">Cuartos</p>
							<div class="br-cells">
								<div class="br-cell"></div>
								<div class="br-cell">{@render tMatch('J1')}</div>
							</div>
						</div>
						<div class="br-concol">
							<p class="t-ronda-tit tit-vacio">&nbsp;</p>
							<div class="br-cells">
								<div class="br-cell"></div>
								<div class="br-cell br-linea"></div>
							</div>
						</div>
						<div class="br-col">
							<p class="t-ronda-tit">Semifinales</p>
							<div class="br-cells">
								<div class="br-cell">{@render tMatch('J2')}</div>
								<div class="br-cell">{@render tMatch('J3')}</div>
							</div>
						</div>
						<div class="br-concol">
							<p class="t-ronda-tit tit-vacio">&nbsp;</p>
							<div class="br-cells">
								<div class="br-cell br-llave"></div>
							</div>
						</div>
						<div class="br-col">
							<p class="t-ronda-tit">Final</p>
							<div class="br-cells">
								<div class="br-cell">{@render tMatch('J5')}</div>
							</div>
						</div>
					</div>
					<div class="br-tercer">
						<p class="t-ronda-tit t-ronda-tit-3">Tercer lugar</p>
						<div class="br-tercer-box">{@render tMatch('J4')}</div>
					</div>
				</div>
			</div>
		</div>
	{:else if subtab === 'captura'}
		<div id="panel-captura" role="tabpanel" aria-labelledby="subtab-captura" tabindex="0">
			<!-- Todos ven los partidos de Q2 y su marcador; SOLO el admin puede EDITARLOS (inputs +
			     botones). Se guarda en `q2_resultados`, aparte de la tabla `partidos`. -->
			<div class="cap">
				<p class="cap-title">
					Partidos · Q2{#if data.isAdmin} <span class="cap-solo">captura admin</span>{/if}
				</p>
				<div class="cap-list">
					{#each q2Juegos as j (j.etiqueta)}
						{@const r = resInicial.get(j.etiqueta)}
						{#if data.isAdmin}
							<form method="POST" action="?/setResult" use:enhance={trasGuardar} class="cap-row">
								<input type="hidden" name="etiqueta" value={j.etiqueta} />
								<span class="cap-et">{j.etiqueta}</span>
								<span class="cap-team a">
									<span class="tname notranslate" translate="no">{j.equipoA}</span>
									<Bandera equipo={j.equipoA} />
								</span>
								<input class="cap-in" type="number" name="golesA" min="0" inputmode="numeric" placeholder="–" value={r?.golesA ?? ''} />
								<span class="cap-dash">–</span>
								<input class="cap-in" type="number" name="golesB" min="0" inputmode="numeric" placeholder="–" value={r?.golesB ?? ''} />
								<span class="cap-team b">
									<Bandera equipo={j.equipoB} />
									<span class="tname notranslate" translate="no">{j.equipoB}</span>
								</span>
								<span class="cap-estado">
									{#if r?.estado === 'vivo'}<span class="cap-tag vivo">en vivo</span>{:else if r}<span class="cap-tag fin">final</span>{/if}
								</span>
								<span class="cap-btns">
									<button type="submit" class="cap-btn ok" title="Guardar resultado FINAL" aria-label="Guardar final">✓</button>
									<button type="submit" formaction="?/setPartial" class="cap-btn partial" title="Guardar EN VIVO (marca en curso · pulsa la tabla)" aria-label="Guardar en vivo">⏱</button>
								</span>
							</form>
						{:else}
							<div class="cap-row">
								<span class="cap-et">{j.etiqueta}</span>
								<span class="cap-team a">
									<span class="tname notranslate" translate="no">{j.equipoA}</span>
									<Bandera equipo={j.equipoA} />
								</span>
								<span class="cap-marcador" class:pend={!r || r.golesA == null || r.golesB == null}>
									{#if r && r.golesA != null && r.golesB != null}{r.golesA} – {r.golesB}{:else}– – –{/if}
								</span>
								<span class="cap-team b">
									<Bandera equipo={j.equipoB} />
									<span class="tname notranslate" translate="no">{j.equipoB}</span>
								</span>
								<span class="cap-estado">
									{#if r?.estado === 'vivo'}<span class="cap-tag vivo">en vivo</span>{:else if r}<span class="cap-tag fin">final</span>{/if}
								</span>
							</div>
						{/if}
					{/each}
				</div>
				{#if actionError}<p class="cap-error">{actionError.error}</p>{/if}
			</div>
		</div>
	{/if}
</section>

<style>
	.q2 {
		box-sizing: border-box;
		padding: 0.4rem 1.25rem 1rem;
		color: rgba(255, 255, 255, 0.95);
		/* Anchos border-box (incluyen padding) para que el offset de las columnas pegadas sea exacto. */
		--w-num: 3rem;
		--w-team: 7.5rem;
	}

	.top {
		margin-bottom: 0.8rem;
		padding-bottom: 0.7rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
	}

	.sub {
		margin: 0 0 0.4rem;
		font-size: 0.85rem;
		font-weight: 400;
		color: #fff;
	}

	.hint {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 400;
		color: #fff;
	}

	/* Leyenda de colores: rosa = resultado, guinda = marcador exacto. */
	.leyenda {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 1.1rem;
		margin: 0.35rem 0 0;
		font-size: 0.72rem;
		color: #fff;
	}

	.leg {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.leg.nota {
		color: rgba(255, 255, 255, 0.6);
	}

	.sw {
		width: 1.5rem;
		height: 0.85rem;
		border-radius: 4px;
		flex-shrink: 0;
	}

	.sw-res {
		background: rgba(240, 76, 158, 0.55);
		border: 1px solid rgba(240, 76, 158, 0.8);
	}

	.sw-exa {
		background: rgba(190, 18, 60, 0.88);
		box-shadow:
			inset 0 0 0 1px rgba(253, 164, 175, 0.6),
			0 0 8px rgba(244, 63, 94, 0.55);
	}

	.table-wrap {
		overflow: auto;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		contain: paint;
	}

	table {
		border-collapse: separate;
		border-spacing: 0;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	th,
	td {
		box-sizing: border-box;
		padding: 0.4rem 0.55rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
		border-right: 1px solid rgba(255, 255, 255, 0.05);
		text-align: center;
	}

	/* Header de participantes: pegado arriba. */
	thead th {
		position: sticky;
		top: 0;
		z-index: 2;
		background: #0a2a19;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.9);
	}

	/* Columnas de identidad del juego: pegadas a la izquierda. */
	.col-num {
		position: sticky;
		left: 0;
		z-index: 1;
		width: var(--w-num);
		min-width: var(--w-num);
		background: #0a2a19;
		color: rgba(255, 255, 255, 0.62);
		font-size: 0.72rem;
		font-weight: 400;
	}

	.col-a {
		position: sticky;
		left: var(--w-num);
		z-index: 1;
		text-align: right;
	}

	.col-b {
		position: sticky;
		left: calc(var(--w-num) + var(--w-team));
		z-index: 1;
		text-align: left;
		border-right: 1px solid rgba(255, 255, 255, 0.18);
	}

	.col-team {
		width: var(--w-team);
		min-width: var(--w-team);
		max-width: var(--w-team);
		overflow: hidden;
		background: #0a2a19;
		font-weight: 400;
	}

	.ti {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		overflow: hidden;
	}

	.ti-a {
		justify-content: flex-end;
	}

	.ti-b {
		justify-content: flex-start;
	}

	.tname {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	/* Esquinas (header + columna pegada): por encima de ambos. */
	thead .col-num,
	thead .col-a,
	thead .col-b {
		z-index: 3;
	}

	.col-p {
		min-width: 2.9rem;
		color: rgba(255, 255, 255, 0.9);
		cursor: pointer;
		user-select: none;
	}

	.prono {
		color: rgba(255, 255, 255, 0.82);
		font-variant-numeric: tabular-nums;
	}

	/* J3: banderita (placeholder) a la derecha del marcador de cada jugador. */
	.prono-flag {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		white-space: nowrap;
	}
	.prono-flag :global(.bandera) {
		font-size: 0.62rem;
	}

	tbody tr:nth-child(even) .prono {
		background: rgba(255, 255, 255, 0.025);
	}

	tbody tr:hover .prono {
		background: rgba(34, 197, 94, 0.1);
	}

	tbody tr:hover .col-num,
	tbody tr:hover .col-team {
		background: #0f3a23;
	}

	/* --- Aciertos: se prenden con el resultado EN VIVO del monitor ---
	   rosa = resultado correcto, guinda = marcador exacto. Van DESPUÉS del
	   striping/hover para ganar el cascade (misma especificidad → gana el último). */
	tbody tr .prono.hit-resultado {
		background: rgba(240, 76, 158, 0.45);
		color: #fff;
		font-weight: 600;
		transition: background 0.25s ease;
	}

	tbody tr .prono.hit-exacto {
		background: rgba(190, 18, 60, 0.88);
		color: #fff;
		font-weight: 700;
		box-shadow:
			inset 0 0 0 1px rgba(253, 164, 175, 0.55),
			0 0 10px rgba(244, 63, 94, 0.45);
		text-shadow: 0 0 8px rgba(253, 164, 175, 0.5);
		transition: background 0.25s ease;
	}

	/* Juego EN VIVO: solo las casillas que están ganando puntos laten. */
	@keyframes vivo-res {
		0%,
		100% {
			background-color: rgba(240, 76, 158, 0.45);
		}
		50% {
			background-color: rgba(240, 76, 158, 0.08);
		}
	}

	@keyframes vivo-exa {
		0%,
		100% {
			background-color: rgba(190, 18, 60, 0.88);
		}
		50% {
			background-color: rgba(190, 18, 60, 0.15);
		}
	}

	tbody tr.envivo .prono.hit-resultado {
		animation: vivo-res 1.3s ease-in-out infinite;
	}

	tbody tr.envivo .prono.hit-exacto {
		animation: vivo-exa 1.3s ease-in-out infinite;
	}

	/* --- Columna fijada por doble clic (sticky-left junto a los equipos) --- */
	.col-p.pinned {
		position: sticky;
		left: calc(var(--w-num) + 2 * var(--w-team));
		z-index: 3;
		box-shadow:
			inset 2px 0 0 rgba(96, 165, 250, 0.85),
			inset -2px 0 0 rgba(96, 165, 250, 0.65);
	}

	tbody tr td.prono.pinned {
		position: sticky;
		left: calc(var(--w-num) + 2 * var(--w-team));
		z-index: 1;
		background: #0a2a19;
		box-shadow:
			inset 2px 0 0 rgba(96, 165, 250, 0.75),
			inset -2px 0 0 rgba(96, 165, 250, 0.55);
	}

	/* Celda fijada que además es acierto: conserva su color pero OPACO (capa sobre
	   base oscura) para que no transparente lo que se desplaza por detrás. */
	tbody tr td.prono.pinned.hit-resultado {
		background: linear-gradient(rgba(240, 76, 158, 0.5), rgba(240, 76, 158, 0.5)), #0a2a19;
		color: #fff;
	}

	tbody tr td.prono.pinned.hit-exacto {
		background: linear-gradient(rgba(190, 18, 60, 0.92), rgba(190, 18, 60, 0.92)), #0a2a19;
		color: #fff;
	}

	.pin {
		margin-right: 0.2rem;
	}

	/* --- Columna RESALTADA por 1 clic (spotlight) --- */
	.col-p.highlighted {
		box-shadow:
			inset 2px 0 0 rgba(255, 255, 255, 0.6),
			inset -2px 0 0 rgba(255, 255, 255, 0.6),
			inset 0 0 0 100px rgba(255, 255, 255, 0.08);
	}

	tbody tr td.prono.highlighted {
		box-shadow:
			inset 2px 0 0 rgba(255, 255, 255, 0.55),
			inset -2px 0 0 rgba(255, 255, 255, 0.55),
			inset 0 0 0 100px rgba(255, 255, 255, 0.12);
	}

	.col-p.pinned.highlighted {
		box-shadow:
			inset 2px 0 0 rgba(96, 165, 250, 0.85),
			inset -2px 0 0 rgba(96, 165, 250, 0.65),
			inset 0 0 0 100px rgba(255, 255, 255, 0.08);
	}

	tbody tr td.prono.pinned.highlighted {
		box-shadow:
			inset 2px 0 0 rgba(96, 165, 250, 0.75),
			inset -2px 0 0 rgba(96, 165, 250, 0.55),
			inset 0 0 0 100px rgba(255, 255, 255, 0.12);
	}

	/* --- Fila (juego) MARCADA por 1 clic en su identidad --- */
	tbody .fila-handle {
		cursor: pointer;
		user-select: none;
	}

	tbody tr.fila-marcada th,
	tbody tr.fila-marcada td {
		box-shadow:
			inset 0 2px 0 rgba(255, 255, 255, 0.6),
			inset 0 -2px 0 rgba(255, 255, 255, 0.6),
			inset 0 0 0 100px rgba(255, 255, 255, 0.1);
	}

	@media (max-width: 600px) {
		.q2 {
			--w-team: 6.5rem;
		}
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}

	/* ---- Subtab bar (chips glass-verde): base de las secciones de la Q2 ----
	   Chips independientes; el activo con borde+glow VERDE de marca (rgba(34,197,94), el mismo
	   acento de foco/chips del sistema, ej. .admin-chip). El azul NO se usa: es "página actual"
	   de la nav global y también la columna .pinned de esta tabla. Escalan a N: agregar un chip
	   es una entrada en SUBTABS; overflow-x scroll si no caben. */
	.subtabs {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.5rem;
		margin: 0 0 0.9rem;
		padding-bottom: 0.15rem; /* aire para que el glow del activo no se recorte al scrollear */
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}
	.subtabs::-webkit-scrollbar {
		display: none;
	}

	.subtab {
		flex: 0 0 auto;
		appearance: none;
		cursor: pointer;
		padding: 0.42rem 0.95rem;
		font-family: inherit;
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		white-space: nowrap;
		color: rgba(255, 255, 255, 0.88);
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 999px;
		text-shadow:
			0 0 8px rgba(255, 255, 255, 0.18),
			0 0 18px rgba(255, 255, 255, 0.08);
		transition:
			background 0.18s ease,
			border-color 0.18s ease,
			color 0.18s ease,
			box-shadow 0.18s ease;
	}

	/* Hover de inactivo: velo blanco, idéntico a .nav-item:hover del sistema. */
	.subtab:hover {
		background: rgba(255, 255, 255, 0.09);
		border-color: rgba(255, 255, 255, 0.16);
		color: #fff;
	}

	/* Foco por teclado: mismo focus-ring verde de los controles del sistema. */
	.subtab:focus-visible {
		outline: none;
		border-color: rgba(34, 197, 94, 0.6);
		box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25);
	}

	/* Activo: velo + borde + glow verde (tratamiento de .admin-chip), texto verde claro. */
	.subtab.active {
		color: #86efac;
		background: rgba(34, 197, 94, 0.16);
		border-color: rgba(34, 197, 94, 0.55);
		box-shadow:
			0 0 0 1px rgba(34, 197, 94, 0.18) inset,
			0 0 12px rgba(34, 197, 94, 0.28);
		text-shadow: 0 0 8px rgba(34, 197, 94, 0.35);
	}
	.subtab.active:hover {
		background: rgba(34, 197, 94, 0.22);
		color: #bbf7d0;
	}
	.subtab.active:focus-visible {
		box-shadow:
			0 0 0 1px rgba(34, 197, 94, 0.18) inset,
			0 0 0 2px rgba(34, 197, 94, 0.25),
			0 0 12px rgba(34, 197, 94, 0.28);
	}

	/* El panel no muestra outline propio al recibir foco programático. */
	[role='tabpanel'] {
		outline: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.subtab {
			transition: none;
		}
	}

	/* ---- Panel de captura de resultados de Q2 (SOLO admin) ---- */
	.cap {
		margin: 0 0 0.9rem;
		padding: 0.6rem 0.75rem;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
	}
	.cap-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.5rem;
		font-size: 0.78rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.85);
	}
	.cap-solo {
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: #86efac;
		background: rgba(34, 197, 94, 0.16);
		border: 1px solid rgba(34, 197, 94, 0.45);
		border-radius: 999px;
		padding: 0.1rem 0.45rem;
	}
	.cap-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.cap-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.cap-et {
		flex: 0 0 auto;
		width: 2rem;
		font-size: 0.72rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.6);
	}
	.cap-team {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.82rem;
	}
	.cap-team.a {
		flex: 1 1 0;
		justify-content: flex-end;
		text-align: right;
		min-width: 5rem;
	}
	.cap-team.b {
		flex: 1 1 0;
		justify-content: flex-start;
		min-width: 5rem;
	}
	.cap-in {
		box-sizing: border-box;
		width: 2.4rem;
		padding: 0.25rem;
		font: inherit;
		font-size: 0.85rem;
		text-align: center;
		color: #fff;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 6px;
	}
	.cap-in:focus-visible {
		outline: none;
		border-color: rgba(34, 197, 94, 0.6);
		box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25);
	}
	.cap-dash {
		color: rgba(255, 255, 255, 0.4);
	}
	/* Marcador en SOLO LECTURA (usuarios no-admin): ocupa el lugar de los dos inputs. */
	.cap-marcador {
		flex: 0 0 auto;
		width: 5.5rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.9);
	}
	.cap-marcador.pend {
		color: rgba(255, 255, 255, 0.35);
	}
	.cap-btns {
		display: inline-flex;
		gap: 0.25rem;
	}
	.cap-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.7rem;
		height: 1.7rem;
		appearance: none;
		cursor: pointer;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.85);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 6px;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}
	.cap-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}
	.cap-btn.ok:hover {
		border-color: rgba(34, 197, 94, 0.6);
		color: #86efac;
	}
	.cap-btn.partial:hover {
		border-color: rgba(56, 189, 248, 0.6);
		color: #7dd3fc;
	}
	/* Slot de ancho fijo para el tag de estado: reservado en TODAS las filas para que
	   la paloma/reloj queden siempre en la misma posición (con y sin resultado). */
	.cap-estado {
		flex: 0 0 auto;
		width: 3.8rem;
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
	}
	.cap-tag {
		white-space: nowrap;
		flex: 0 0 auto;
		padding: 0.08rem 0.4rem;
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		border-radius: 999px;
	}
	.cap-tag.vivo {
		color: #7dd3fc;
		background: rgba(56, 189, 248, 0.15);
		border: 1px solid rgba(56, 189, 248, 0.4);
	}
	.cap-tag.fin {
		color: #86efac;
		background: rgba(34, 197, 94, 0.14);
		border: 1px solid rgba(34, 197, 94, 0.4);
	}
	.cap-error {
		margin: 0.5rem 0 0;
		font-size: 0.72rem;
		color: #fecaca;
	}

	@media (max-width: 600px) {
		.cap-team {
			min-width: 3.5rem;
			font-size: 0.75rem;
		}
	}

	/* ---- Subtab "Posiciones" (equivalente a Lugares, adaptado a Q2) ----
	   Ojo: los selectores genéricos de arriba (th/td/thead th) también tocan esta
	   tabla, por eso .pos-table los re-declara (sin sticky, sin border-right). */
	.pos {
		display: flex;
		flex-direction: column;
	}
	.pos-sub {
		margin: 0 0 0.7rem;
		font-size: 0.85rem;
		color: #fff;
	}
	.pos-sub strong {
		font-weight: 700;
	}
	.pos-empty {
		margin: 0 0 1rem;
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.7);
	}
	.pos-cols-desktop {
		display: flex;
		flex-wrap: nowrap;
		justify-content: center;
		align-items: flex-start;
		gap: 1.25rem;
	}
	.pos-cols-mobile {
		display: none;
	}
	@media (max-width: 60rem) {
		.pos-cols-desktop {
			display: none;
		}
		.pos-cols-mobile {
			display: block;
		}
	}
	.pos-wrap {
		flex: 1 1 26rem;
		min-width: 0;
		max-width: 34rem;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
	}
	.pos-cols-mobile .pos-wrap {
		max-width: none;
	}
	.pos-table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-size: 0.9rem;
		white-space: nowrap;
	}
	.pos-table th,
	.pos-table td {
		box-sizing: border-box;
		padding: 0.55rem 0.8rem;
		border-right: 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
		text-align: center;
	}
	.pos-table thead th {
		position: static;
		z-index: auto;
		background: #0a2a19;
		font-weight: 700;
		font-size: 0.78rem;
		color: rgba(255, 255, 255, 0.9);
	}
	.pc-pos {
		width: 4.2rem;
		color: rgba(255, 255, 255, 0.6);
	}
	.pc-slot {
		display: inline-block;
	}
	.pc-slot.medal {
		width: 1.3rem;
		text-align: right;
	}
	.pc-slot.rank {
		width: 1.5rem;
		padding-left: 0.35rem;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.pc-name {
		text-align: left;
		font-weight: 400;
		color: rgba(255, 255, 255, 0.95);
	}
	.pc-pts {
		width: 4rem;
		font-size: 1.05rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.pc-n {
		width: 5.5rem;
		color: rgba(255, 255, 255, 0.7);
		font-variant-numeric: tabular-nums;
	}
	.pos-table tbody tr:hover td,
	.pos-table tbody tr:hover .pc-name {
		background: rgba(255, 255, 255, 0.05);
	}
	.pos-table tbody tr.pos-podio {
		background: rgba(34, 197, 94, 0.07);
	}
	.pos-table tbody tr.pos-podio .pc-pts {
		color: #86efac;
	}
	.pos-table thead th.pc-pts {
		color: #bbf7d0;
		background: #0c3d24;
		box-shadow:
			inset 2px 0 0 rgba(134, 239, 172, 0.55),
			inset -2px 0 0 rgba(134, 239, 172, 0.55);
	}
	.pos-table tbody td.pc-pts {
		color: #bbf7d0;
		box-shadow:
			inset 2px 0 0 rgba(134, 239, 172, 0.45),
			inset -2px 0 0 rgba(134, 239, 172, 0.45),
			inset 0 0 0 100px rgba(34, 197, 94, 0.12);
	}

	/* ---- Subtab "Torneo": bracket estilo FIFA con ramificaciones (llaves como Segunda Ronda) ---- */
	.t-sub {
		margin: 0 0 0.8rem;
		font-size: 0.82rem;
		color: rgba(255, 255, 255, 0.8);
	}
	.torneo-wrap {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		padding-bottom: 0.4rem;
	}
	.torneo-inner {
		display: flex;
		flex-direction: column;
		width: max-content;
	}
	.t-ronda-tit {
		margin: 0 0 0.6rem;
		text-align: center;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.5);
	}
	.tit-vacio {
		visibility: hidden;
	}
	/* Columnas de ronda (con tarjetas) y columnas conectoras (con las llaves). Las celdas usan
	   flex:1 para que sus centros se alineen entre rondas (J1 con J3; J5 entre J2 y J3). */
	.br {
		--linea: rgba(34, 197, 94, 0.5);
		--concol: 2.4rem;
		display: flex;
		align-items: stretch;
		width: max-content;
		padding: 1.2rem 0.2rem 0.4rem;
	}
	.br-col {
		display: flex;
		flex-direction: column;
	}
	.br-concol {
		display: flex;
		flex-direction: column;
		flex: 0 0 var(--concol);
		width: var(--concol);
	}
	.br-cells {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.br-cell {
		flex: 1 1 0;
		display: flex;
		align-items: center;
		position: relative;
		min-height: 3.1rem;
	}
	/* J1 → J3 (pase directo 1→1): línea horizontal a través del conector. */
	.br-linea::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		border-top: 2px solid var(--linea);
	}
	/* Llave semifinales → final (2→1): brazos a J2 (25%) y J3 (75%) + espina + salida a J5 (50%). */
	.br-llave::before {
		content: '';
		position: absolute;
		left: 0;
		width: 50%;
		top: 25%;
		bottom: 25%;
		border-right: 2px solid var(--linea);
		border-top: 2px solid var(--linea);
		border-bottom: 2px solid var(--linea);
	}
	.br-llave::after {
		content: '';
		position: absolute;
		left: 50%;
		right: 0;
		top: 50%;
		border-top: 2px solid var(--linea);
	}
	/* Tarjeta de partido */
	.t-match {
		position: relative;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.28rem;
		width: 12.5rem;
		min-height: 2.9rem;
		padding: 0.45rem 0.6rem 0.45rem 1.15rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
	}
	.t-match.t-jugado {
		border-color: rgba(250, 204, 21, 0.5);
		box-shadow:
			0 0 0 1px rgba(250, 204, 21, 0.25),
			0 0 10px rgba(250, 204, 21, 0.18);
	}
	.t-match.t-final {
		border-color: rgba(250, 204, 21, 0.55);
	}
	.t-trofeo {
		position: absolute;
		bottom: 100%; /* ARRIBA de la tarjeta (afuera), no encima del borde */
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: 0.25rem;
		font-size: 1.15rem;
		filter: drop-shadow(0 0 6px rgba(250, 204, 21, 0.5));
		z-index: 2;
	}
	.t-num {
		position: absolute;
		left: 0.4rem;
		top: 50%;
		transform: translateY(-50%);
		font-size: 0.6rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.35);
	}
	.t-lado {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}
	.t-nm {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
		font-size: 0.8rem;
	}
	.t-ph {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.74rem;
		font-style: italic;
		color: rgba(255, 255, 255, 0.5);
	}
	.t-g {
		margin-left: auto;
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.55);
	}
	.t-lado.t-gana .t-nm,
	.t-lado.t-gana .t-g {
		color: #86efac;
	}
	/* 3er lugar: debajo de la columna de la Final (alineado a la derecha del cuadro), como en FIFA. */
	.br-tercer {
		width: 12.5rem;
		margin-left: auto;
		margin-top: 0.7rem;
		padding-top: 0.8rem;
		border-top: 1px dashed rgba(255, 255, 255, 0.12);
	}
	.t-ronda-tit-3 {
		text-align: center;
		margin-bottom: 0.4rem;
	}
</style>
