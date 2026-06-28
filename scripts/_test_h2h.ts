import { computeGrupos } from '../src/lib/grupos.ts';

// Grupo A (México/Sudáfrica/Corea/R. Checa). Escenario donde el head-to-head IMPORTA:
//  • México y Sudáfrica empatan a 6 pts. México le GANÓ a Sudáfrica (1-0) PERO Sudáfrica tiene mejor
//    DG general (+6 vs -1). FIFA: manda el head-to-head → México arriba. (Sin h2h: Sudáfrica.)
//  • Corea y R. Checa empatan a 3 pts. Corea le GANÓ a R. Checa (1-0) pero R. Checa tiene mejor DG
//    general (0 vs -5). FIFA: Corea arriba. (Sin h2h: R. Checa.)
const partidos = [
	{ numero: 1, equipoA: 'México', equipoB: 'Sudáfrica', golesA: 1, golesB: 0 },
	{ numero: 2, equipoA: 'México', equipoB: 'Corea', golesA: 1, golesB: 0 },
	{ numero: 3, equipoA: 'México', equipoB: 'R. Checa', golesA: 0, golesB: 3 },
	{ numero: 4, equipoA: 'Sudáfrica', equipoB: 'Corea', golesA: 5, golesB: 0 },
	{ numero: 5, equipoA: 'Sudáfrica', equipoB: 'R. Checa', golesA: 2, golesB: 0 },
	{ numero: 6, equipoA: 'Corea', equipoB: 'R. Checa', golesA: 1, golesB: 0 }
];

const g = computeGrupos(partidos)[0];
const orden = g.equipos.map((e) => `${e.pos}. ${e.equipo} (${e.pts}pts, DG ${e.dg})`);
console.log('Grupo', g.label, 'orden:\n  ' + orden.join('\n  '));

const esperado = ['México', 'Sudáfrica', 'Corea', 'R. Checa'];
const real = g.equipos.map((e) => e.equipo);
const ok = JSON.stringify(real) === JSON.stringify(esperado);
console.log('\nEsperado (FIFA h2h):', esperado.join(', '));
console.log('Obtenido:          ', real.join(', '));
console.log(ok ? '\n✅ PASA: el head-to-head ordena correcto' : '\n❌ FALLA');
process.exit(ok ? 0 : 1);
