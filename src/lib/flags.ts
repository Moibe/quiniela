// Mapa de nombre de equipo (tal cual está en la DB: español abreviado) → código
// de bandera de flag-icons (ISO 3166-1 alpha-2; + gb-eng / gb-sct para las
// "home nations"). Si un nombre no está aquí, no se muestra bandera (el nombre
// sí), así que un faltante degrada bien.
const MAPA: Record<string, string> = {
	Alemania: 'de',
	Arabia: 'sa', // Arabia Saudita
	Argelia: 'dz',
	Argentina: 'ar',
	Australia: 'au',
	Austria: 'at',
	Bosnia: 'ba',
	Brasil: 'br',
	Bélgica: 'be',
	'C. de Marfil': 'ci',
	'C. Verde': 'cv', // Cabo Verde
	Canadá: 'ca',
	Catar: 'qa',
	Colombia: 'co',
	Congo: 'cg', // ⚠️ Rep. del Congo (cg). Si es RD Congo, cambiar a 'cd'.
	Corea: 'kr', // Corea del Sur
	Croacia: 'hr',
	Curazao: 'cw',
	'E. Unidos': 'us',
	Ecuador: 'ec',
	Egipto: 'eg',
	Escocia: 'gb-sct',
	España: 'es',
	Francia: 'fr',
	Ghana: 'gh',
	Haití: 'ht',
	Inglaterra: 'gb-eng',
	Irak: 'iq',
	Irán: 'ir',
	Japón: 'jp',
	Jordania: 'jo',
	Marruecos: 'ma',
	México: 'mx',
	'N. Zelanda': 'nz',
	Noruega: 'no',
	'P. Bajos': 'nl', // Países Bajos
	Panamá: 'pa',
	Paraguay: 'py',
	Portugal: 'pt',
	'R. Checa': 'cz',
	Senegal: 'sn',
	Sudáfrica: 'za',
	Suecia: 'se',
	Suiza: 'ch',
	Turquía: 'tr',
	Túnez: 'tn',
	Uruguay: 'uy',
	Uzbekistán: 'uz'
};

export function codigoBandera(equipo: string): string | null {
	return MAPA[equipo.trim()] ?? null;
}
