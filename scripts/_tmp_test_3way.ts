import { computeGrupos } from '../src/lib/grupos.ts';

// Helper to print a group ordering
function show(title: string, partidos: any[]) {
	const g = computeGrupos(partidos)[0];
	console.log('\n=== ' + title + ' ===');
	console.log('Grupo', g.label);
	for (const e of g.equipos) {
		console.log(`  ${e.pos}. ${e.equipo}  pts=${e.pts} dg=${e.dg} gf=${e.gf}`);
	}
}

// ----------------------------------------------------------------------------
// SCENARIO 1: Classic FIFA re-apply / recursion case.
// 3 teams tied on points at top. Among the 3, the mini-table SEPARATES one team
// out but leaves the other two STILL tied on h2h points. FIFA says: once a team
// separates, RE-APPLY the full criteria (incl. a fresh head-to-head) ONLY to the
// remaining tied subset. A flat (non-recursive) implementation might order the
// remaining two by their h2h record *computed over all 3 teams* instead of
// recomputing among just the 2 — usually the same, but NOT always.
//
// Group: A, B, C, D.
//  A, B, C each finish on 6 pts (each beat D, and the 3-way among them is a cycle
//  OR partially separates). D loses all.
//
// Construct so the 3-way mini-table gives:
//   A: 4 pts h2h, B: 3 pts h2h... no — let's make A separate at TOP via h2h pts,
//   then B vs C tied on h2h pts but B beat C head-to-head.
// ----------------------------------------------------------------------------

// A beats B, A beats C  -> A has 6 h2h pts (separates at top)
// B beats C             -> B 3 h2h, C 0 h2h
// All three beat D.
// Here flat == recursive (B>C by h2h anyway). Sanity baseline.
show('S1 baseline 3-way, A separates, B>C', [
	{ numero: 1, equipoA: 'A', equipoB: 'B', golesA: 1, golesB: 0 },
	{ numero: 2, equipoA: 'A', equipoB: 'C', golesA: 1, golesB: 0 },
	{ numero: 3, equipoA: 'B', equipoB: 'C', golesA: 1, golesB: 0 },
	{ numero: 4, equipoA: 'A', equipoB: 'D', golesA: 5, golesB: 0 },
	{ numero: 5, equipoA: 'B', equipoB: 'D', golesA: 5, golesB: 0 },
	{ numero: 6, equipoA: 'C', equipoB: 'D', golesA: 5, golesB: 0 }
]);

// ----------------------------------------------------------------------------
// SCENARIO 2: The DIVERGENCE case (flat vs recursive can differ).
// Make A, B, C tied on points (6 each, all beat D).
// 3-way mini-table:
//   A beats B big, B beats C, C beats A small.  -> circular on h2h pts (all 3 pts).
// Then within the 3-cycle, separate by h2h GD. Suppose A separates at TOP on
// h2h GD. The remaining B, C: FIFA re-applies -> direct match B vs C decides.
// Build numbers so that:
//   - over the 3-way table, B and C have EQUAL h2h GD and EQUAL h2h goals,
//   - but B beat C head-to-head.
// Recursive FIFA: after A leaves, B>C by their direct result.
// Flat impl (this code): B and C compared by 3-way h2h pts(equal) -> 3-way h2h
//   GD(equal) -> 3-way h2h goals(equal) -> overall GD -> overall goals -> name.
//   It will NOT look at the direct B-vs-C result; it falls through to OVERALL.
// So if C has better OVERALL GD than B, flat puts C above B even though B beat C.
// That is the recursion deviation.
// ----------------------------------------------------------------------------

// h2h among A,B,C (each plays 2):
//  A vs B: A 3-0  (A +3, B -3)
//  B vs C: B 2-1  (B +1, C -1)
//  C vs A: C 2-0  (C +2, A -2)
// h2h points: A=3, B=3, C=3 (circular). h2h GD: A = +3-2=+1, B=-3+1=-2, C=-1+2=+1
//  -> A=+1, C=+1, B=-2. So B is last of the trio on h2h GD; A & C tied on h2h GD +1.
//  h2h goals: A=3+0=3, B=0+2=2, C=1+2=3 -> A=3, C=3 tie, B=2.
//  So A and C tied through h2h pts, h2h GD, h2h goals. Decide A vs C by OVERALL.
//  Then B is clearly last of trio.
// This separates B to BOTTOM of trio (not the interesting "subset re-apply").
//
// Let me instead target the cleaner pattern: ONE team separates at TOP, other two
// remain tied on ALL h2h metrics but have a decisive direct result.
//   A vs B: 1-1  (draw)
//   A vs C: 1-1  (draw)
//   B vs C: B 2-0
// h2h pts: A=2, B=4, C=1.  B separates at TOP (4). Remaining A,C tied? A=2,C=1 no.
// Hmm need A and C equal. Try:
//   B vs A: 1-0, B vs C: 1-0  (B beats both -> B 6 h2h, top)
//   A vs C: 1-1 draw -> A=1, C=1 h2h pts equal; A gd over trio = 0-1 +0 = -1; C = -1+0=-1
//   A goals trio = 0+1=1 ; C = 0+1=1. Fully tied A vs C on every h2h metric AND
//   their direct game was a draw -> genuinely tied, overall GD is the legit next
//   step for BOTH flat and recursive. Not a divergence.
//
// The real divergence needs the remaining pair tied on the *3-way* aggregate but
// NOT tied head-to-head directly. With only one game between them that can't happen
// for a pair (their direct game fully determines their 2-team h2h). So for a 2-team
// remaining subset, flat 3-way h2h pts/GD/goals being equal IMPLIES the direct game
// was a draw => recursive 2-team h2h also a draw => same result. The divergence
// would require >2 teams remaining after partial separation, i.e. a 4-way tie in a
// 4-team group = all 4 level. Test that below.
show('S2 trio circular, B last', [
	{ numero: 1, equipoA: 'A', equipoB: 'B', golesA: 0, golesB: 3 },
	{ numero: 2, equipoA: 'C', equipoB: 'A', golesA: 2, golesB: 0 },
	{ numero: 3, equipoA: 'B', equipoB: 'C', golesA: 2, golesB: 1 },
	{ numero: 4, equipoA: 'A', equipoB: 'D', golesA: 5, golesB: 0 },
	{ numero: 5, equipoA: 'B', equipoB: 'D', golesA: 5, golesB: 0 },
	{ numero: 6, equipoA: 'C', equipoB: 'D', golesA: 5, golesB: 0 }
]);

// ----------------------------------------------------------------------------
// SCENARIO 3: ALL FOUR teams tied on points (every game a draw of varying scores
// OR a perfect cycle). This is where recursion (re-apply to a separated subset)
// can genuinely diverge from the flat single-pass approach.
//
// All 6 games drawn 0-0 -> everyone 3 pts, all h2h equal, all overall equal ->
// resolved by name. Both flat and recursive agree (fully symmetric). Not useful.
//
// Build: a partial separation among 4. Two teams (A,B) clearly top the 4-way
// mini-table, two (C,D) clearly bottom. Within {A,B}: their direct game decides.
// Within {C,D}: direct game decides. Flat handles top/bottom split fine because
// the 4-way h2h pts already separate them. The subtle case: 4-way h2h pts give
// A=B (tied) at top and the only thing that separates them in the FULL 4-way table
// is 4-way GD, but head-to-head A-vs-B (direct) contradicts the 4-way GD.
//   FIFA recursion: A,B tied on 4-way pts -> at this level still use 4-way GD?
//   Actually FIFA re-applies the WHOLE criteria set to the tied subset {A,B} from
//   the TOP: subset h2h pts (their direct game) first. So direct A-vs-B result
//   should win over 4-way GD.
//   Flat impl: uses 4-way h2h GD (computed over all 4) to separate A,B -> may
//   contradict their direct result.
//
// Construct: 4-way h2h pts A=B=4(?), need both top. Let:
//   A: beats C, beats D, draws? ... let's just brute force numbers.
//   Aim: A and B both 4-way h2h pts = X (tied at top), C and D lower.
//   A vs B direct: B wins 1-0  (so recursion: B above A)
//   But A has much better 4-way GD than B (A hammered C and D; B scraped wins)
//   so flat puts A above B. DIVERGENCE.
// Games:
//   A vs B: 0-1  (B beats A)            A:0pts B:3
//   A vs C: 5-0  (A wins big)           A:+3pts
//   A vs D: 5-0  (A wins big)           A:+3pts   -> A 4-way pts = 6, GD = -1+5+5=+9
//   B vs C: 1-0                         B:+3
//   B vs D: 1-0                         B:+3      -> B 4-way pts = 3+3+3 = 9?? recount
// Wait each team plays 3 games (all are in the 4-way set). Let me recount fully.
// A games: vs B (0-1 L), vs C (5-0 W), vs D (5-0 W) -> A pts = 0+3+3 = 6
// B games: vs A (1-0 W), vs C (1-0 W), vs D (1-0 W) -> B pts = 3+3+3 = 9
// Not tied. To tie A and B at 4-way pts, give each 2 wins 1 loss within the group.
//   A: W vs C, W vs D, L vs B            -> 6 pts
//   B: W vs A, L vs C, W vs D            -> 6 pts
//   C: L vs A, W vs B, ? vs D
//   D: L vs A, L vs B, ? vs C
//   C vs D: C wins -> C: 3+? ; let's see pts: A6 B6 and we need ALL FOUR tied -> C,D also 6. Impossible with these.
// All-four-tied-on-points in a 4-team RR requires each team 1W1D... actually each
// plays 3 games; equal points for all 4 needs e.g. everyone 3 pts (all draws) or a
// rock-paper-scissors of 1W1D1L = 4 pts each. Use the 4-cycle of wins won't equalize.
// Use 1W1D1L each (4 pts):
//   A beats B, A draws C, A loses D
//   B beats C, B draws D, (B loses A)
//   C beats D, (C draws A), (C loses B)
//   D beats A, (D draws B), (D loses C)
//  Check each: A: W(B)+D(C)+L(D)=4 ; B: W(C)+D(D)+L(A)=4 ; C: W(D)+D(A)+L(B)=4 ;
//   D: W(A)+D(B)+L(C)=4. All 4 tied on 4 pts.
// Now 4-way h2h == overall (all games are intra-group). So h2h GD == overall GD.
// Make GD differ to force a specific order, then check whether the DIRECT results
// are respected by the flat sort. With everyone 1W1D1L the cycle is symmetric;
// the flat sort will use h2h GD then h2h goals then name. Whatever it outputs, the
// question is only whether it's a *defensible* FIFA result. Print it.
show('S3 four-way 1W1D1L cycle (4 pts each)', [
	{ numero: 1, equipoA: 'A', equipoB: 'B', golesA: 2, golesB: 0 }, // A beats B
	{ numero: 2, equipoA: 'A', equipoB: 'C', golesA: 1, golesB: 1 }, // A draws C
	{ numero: 3, equipoA: 'D', equipoB: 'A', golesA: 3, golesB: 0 }, // D beats A
	{ numero: 4, equipoA: 'B', equipoB: 'C', golesA: 2, golesB: 0 }, // B beats C
	{ numero: 5, equipoA: 'B', equipoB: 'D', golesA: 1, golesB: 1 }, // B draws D
	{ numero: 6, equipoA: 'C', equipoB: 'D', golesA: 4, golesB: 0 }  // C beats D
]);

// ----------------------------------------------------------------------------
// SCENARIO 4: Partial group (live / not all matches played). Only some matches
// have scores. Two teams sit on equal points but have NOT yet played each other.
// h2h mini-table among them is EMPTY -> all zeros -> falls through to overall.
// Should be sane (no crash, deterministic).
// ----------------------------------------------------------------------------
show('S4 partial: A,B both 3pts, have NOT played each other', [
	{ numero: 1, equipoA: 'A', equipoB: 'C', golesA: 1, golesB: 0 },   // A 3pts
	{ numero: 2, equipoA: 'B', equipoB: 'D', golesA: 5, golesB: 0 },   // B 3pts, big GD
	{ numero: 3, equipoA: 'A', equipoB: 'D', golesA: null, golesB: null },
	{ numero: 4, equipoA: 'A', equipoB: 'B', golesA: null, golesB: null }, // not played
	{ numero: 5, equipoA: 'B', equipoB: 'C', golesA: null, golesB: null },
	{ numero: 6, equipoA: 'C', equipoB: 'D', golesA: null, golesB: null }
]);
