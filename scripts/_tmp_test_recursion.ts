import { computeGrupos } from '../src/lib/grupos.ts';

function show(title: string, partidos: any[]) {
	const g = computeGrupos(partidos)[0];
	console.log('\n=== ' + title + ' ===');
	for (const e of g.equipos) {
		console.log(`  ${e.pos}. ${e.equipo}  pts=${e.pts} dg=${e.dg} gf=${e.gf}`);
	}
}

// ----------------------------------------------------------------------------
// THE RECURSION DIVERGENCE CASE.
// All 4 teams level on overall points. Among them, A & B clearly outscore C & D
// in head-to-head POINTS (A,B form the "top pair", C,D the "bottom pair").
// FIFA: once the top pair {A,B} is isolated, re-apply criteria FROM THE TOP to
// just {A,B}: their DIRECT match (h2h pts between only A and B) decides first.
// Likewise re-apply to {C,D}: their direct match decides.
//
// The flat implementation does NOT recompute. It ranks all 4 in one pass by the
// 4-way mini-table: h2h pts -> h2h GD -> h2h goals -> overall ... Within the top
// pair, after equal 4-way h2h pts it uses 4-way h2h GD (aggregate over games vs
// C and D too), NOT the direct A-vs-B result. If A-vs-B direct result CONTRADICTS
// the 4-way GD aggregate, flat and recursive diverge.
//
// Design points (each team plays 3 intra-group games):
//   Top pair A,B: each beat C and D (so each has 6 h2h pts from those 2 wins),
//     and A vs B is decisive (say B beats A). Then:
//       A h2h pts = 6 (W vs C, W vs D, L vs B)
//       B h2h pts = 9 (W vs A, W vs C, W vs D)
//     Not equal -> B separates above A cleanly; flat == recursive. Not a divergence.
//   To make A and B TIED on 4-way h2h pts while their direct game is decisive,
//   give them each 1W-1L vs {C,D} plus the A-B game:
//       A: W vs C, L vs D, ? vs B
//       B: L vs C, W vs D, ? vs A
//     For both to top the table over C,D we actually need C,D to also be ~equal.
//   This is the classic "everyone 1W1D1L or a balanced cycle" -> symmetric, the
//   pure-cycle case. In a symmetric 4-cycle the *direct* result between two
//   adjacent teams is the ONLY thing distinguishing an otherwise symmetric pair,
//   and FIFA's recursion is what surfaces it. The flat code cannot.
//
// Concrete construction (a 4-cycle where A beats B beats C beats D beats A, plus
// the two "diagonal" games drawn), engineered so that:
//   * all 4 end on equal overall points,
//   * the 4-way h2h pts tie A with C and B with D (or similar) such that the
//     ONLY correct separator for a pair is their direct game,
//   * overall GD is rigged to put the head-to-head LOSER above the winner in the
//     flat sort.
// ----------------------------------------------------------------------------

// Cycle: A>B, B>C, C>D, D>A (each 1-0). Diagonals A-C and B-D drawn 0-0.
//   Pts: A: W(B)+L(D)+D(C)=4 ; B: W(C)+L(A)+D(D)=4 ; C: W(D)+L(B)+D(A)=4 ;
//        D: W(A)+L(C)+D(B)=4. All tied at 4.  (h2h == overall here.)
// h2h GD all 0, h2h goals all 1. So flat resolves purely by NAME -> A,B,C,D.
// FIFA recursion also bottoms out at fair-play/ranking -> here name. SAME. (sym.)
show('R1 perfect symmetric 4-cycle (resolves by name, both agree)', [
	{ numero: 1, equipoA: 'A', equipoB: 'B', golesA: 1, golesB: 0 },
	{ numero: 2, equipoA: 'B', equipoB: 'C', golesA: 1, golesB: 0 },
	{ numero: 3, equipoA: 'C', equipoB: 'D', golesA: 1, golesB: 0 },
	{ numero: 4, equipoA: 'D', equipoB: 'A', golesA: 1, golesB: 0 },
	{ numero: 5, equipoA: 'A', equipoB: 'C', golesA: 0, golesB: 0 },
	{ numero: 6, equipoA: 'B', equipoB: 'D', golesA: 0, golesB: 0 }
]);

// ----------------------------------------------------------------------------
// R2: TOP-PAIR isolation with a contradicting direct result.
// Make A and B tie at the top on h2h pts; C and D below. A vs B direct: A wins.
// But B has a better 4-way h2h GD (because B trounced C/D while A won narrowly).
// FIFA recursion: {A,B} isolated -> direct game (A beat B) -> A above B.
// Flat: A,B equal on 4-way h2h pts -> compare 4-way h2h GD -> B above A. DIVERGE.
//
// Need all 4 on equal OVERALL points though (so the whole block is one tie).
// Points target: all 4 == 4 pts (1W1D1L each) is the only all-equal pattern that
// also lets a pair dominate h2h pts... but 1W1D1L gives everyone equal h2h pts (3)
// so no pair dominates. The ONLY way a *pair* leads h2h pts while all 4 share
// overall points is if h2h != overall, i.e. NOT all games are intra-group — but in
// a 4-team group every game IS intra-group. So a full 4-way tie always has
// h2h pts identical for all (each played the same 3 opponents = the whole set).
// => In a complete 4-way tie, h2h pts can ONLY rank by total points, which are
//    equal, so h2h pts NEVER separates a sub-pair. The separation always comes
//    from h2h GD / goals, which equal overall GD / goals. CONCLUSION: for a full
//    4-way tie there is NO recursion to do — the subset == the whole set, the
//    mini-table == the full table, flat == recursive BY CONSTRUCTION.
//    The interesting recursion only exists for a 3-way tie inside a 4-team group.
// ----------------------------------------------------------------------------

// 3-WAY tie, A separates at top on h2h pts, leaving B & C. As argued, B vs C as a
// 2-team remnant: flat uses 3-way h2h GD/goals; recursion uses their direct game.
// Build B,C so 3-way h2h GD & goals are EQUAL but direct game is decisive.
//   Trio A,B,C (each plays 2 intra-trio games; all 3 also beat D for equal pts).
//   A vs B: A 1-0 ; A vs C: A 1-0  -> A h2h pts 6 (top, separates)
//   B vs C: B 2-1  -> B h2h pts 3, C 0. NOT equal -> B>C by h2h pts. (flat=rec)
//   The remnant {B,C} can never be "tied on h2h GD/goals but decisive direct game"
//   because their direct game IS the only h2h game between them; equal GD/goals in
//   the 2-team remnant <=> that game was a draw <=> not decisive. So again flat==rec.
//
// MATHEMATICAL CONCLUSION: in a 4-team group, the flat single-pass over the tied
// block produces the SAME ordering FIFA's recursive re-application would, in every
// case, because every tied remnant is either (i) a 2-team set whose h2h is one
// game (flat already uses exactly that game), or (ii) the full set (mini==full).
// The only theoretical gap (a >=3-team remnant that stays tied after a partial
// separation) cannot arise in a 4-team round-robin. Print R2 just to confirm no
// crash on a 3-way that separates cleanly.
show('R2 3-way A top, B>C by direct game', [
	{ numero: 1, equipoA: 'A', equipoB: 'B', golesA: 1, golesB: 0 },
	{ numero: 2, equipoA: 'A', equipoB: 'C', golesA: 1, golesB: 0 },
	{ numero: 3, equipoA: 'B', equipoB: 'C', golesA: 2, golesB: 1 },
	{ numero: 4, equipoA: 'A', equipoB: 'D', golesA: 1, golesB: 0 },
	{ numero: 5, equipoA: 'B', equipoB: 'D', golesA: 1, golesB: 0 },
	{ numero: 6, equipoA: 'C', equipoB: 'D', golesA: 1, golesB: 0 }
]);
