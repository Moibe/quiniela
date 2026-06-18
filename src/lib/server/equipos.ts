// Canonicaliza nombres de equipo para emparejar la quiniela (español, a veces abreviado/variante)
// con Cloudbet (español o inglés). Normaliza (minúsculas, sin acentos/puntuación) y mapea sinónimos
// a una clave canónica. Para selecciones del Mundial. Si un equipo nuevo no casa, se agrega aquí
// (o se usa el override por URL en /labs).
function normaliza(s: string): string {
	return (s ?? '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '') // quita acentos
		.replace(/[.,'`’&]/g, ' ') // puntos, comas, apóstrofos, & (p.ej. "Bosnia & Herzegovina")
		.replace(/\s+/g, ' ')
		.trim();
}

// variante (ya normalizada) -> clave canónica (también normalizada). Cubre ES abreviado/pleno + EN.
const SINONIMOS: Record<string, string> = {
	germany: 'alemania',
	arabia: 'arabia saudita',
	'arabia saudi': 'arabia saudita',
	'saudi arabia': 'arabia saudita',
	algeria: 'argelia',
	belgium: 'belgica',
	brazil: 'brasil',
	'c verde': 'cabo verde',
	'cape verde': 'cabo verde',
	'c de marfil': 'costa de marfil',
	'ivory coast': 'costa de marfil',
	'cote divoire': 'costa de marfil',
	'cote d ivoire': 'costa de marfil',
	qatar: 'catar',
	'dr congo': 'congo',
	'congo dr': 'congo',
	'rd congo': 'congo',
	korea: 'corea',
	'south korea': 'corea',
	'korea republic': 'corea',
	'corea del sur': 'corea',
	croatia: 'croacia',
	curacao: 'curazao',
	'e unidos': 'estados unidos',
	'united states': 'estados unidos',
	usa: 'estados unidos',
	egypt: 'egipto',
	scotland: 'escocia',
	spain: 'espana',
	france: 'francia',
	england: 'inglaterra',
	iraq: 'irak',
	japan: 'japon',
	jordan: 'jordania',
	morocco: 'marruecos',
	'n zelanda': 'nueva zelanda',
	'new zealand': 'nueva zelanda',
	norway: 'noruega',
	'p bajos': 'paises bajos',
	netherlands: 'paises bajos',
	holland: 'paises bajos',
	holanda: 'paises bajos',
	'r checa': 'republica checa',
	'czech republic': 'republica checa',
	czechia: 'republica checa',
	'south africa': 'sudafrica',
	sweden: 'suecia',
	switzerland: 'suiza',
	turkey: 'turquia',
	turkiye: 'turquia',
	tunisia: 'tunez',
	'bosnia and herzegovina': 'bosnia',
	'bosnia y herzegovina': 'bosnia',
	'bosnia herzegovina': 'bosnia'
};

/** Clave canónica de un equipo (para comparar quiniela <-> Cloudbet sin importar idioma/abreviatura). */
export function canonEquipo(nombre: string): string {
	const n = normaliza(nombre);
	return SINONIMOS[n] ?? n;
}

/** Clave de un partido (par de equipos), independiente del orden local/visita. */
export function clavePartido(a: string, b: string): string {
	return [canonEquipo(a), canonEquipo(b)].sort().join(' | ');
}
