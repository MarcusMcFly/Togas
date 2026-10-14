/**
 * Cómo se presenta cada nivel de intensidad (1 = Diminuto … 5 = Legendario).
 * Solo afecta a lo visual y sonoro: nunca a la puntuación ni a la física.
 */
export interface TierPresentation {
  tier: number;
  /** Nombre de la spec (inglés). */
  name: string;
  /** Nombre que se muestra al jugador. */
  label: string;
  /** Color del texto cómico y de los indicadores. */
  color: string;
  particles: number;
  /** Escala de la nube de gas grande (0 = sin nube grande). */
  cloudScale: number;
  /** Radio de la onda expansiva en píxeles (0 = sin onda). */
  ringRadius: number;
  /** Retroceso visual del personaje en píxeles. */
  recoil: number;
  /** Intensidad de la sacudida de cámara (fracción de pantalla). 0 = sin sacudida. */
  shake: number;
  textSize: number;
  words: { burp: readonly string[]; fart: readonly string[] };
  /** Las palomas cercanas salen volando. */
  scareBirds: boolean;
  /** Destello de pantalla y confeti. */
  celebrate: boolean;
}

export const EMISSION_TIERS: readonly TierPresentation[] = [
  {
    tier: 1, name: 'Tiny', label: 'Diminuto', color: '#d7f0b0',
    particles: 6, cloudScale: 0, ringRadius: 0, recoil: 2, shake: 0, textSize: 24,
    words: { burp: ['burp', 'hip'], fart: ['prrt', 'pff'] },
    scareBirds: false, celebrate: false,
  },
  {
    tier: 2, name: 'Noticeable', label: 'Notable', color: '#b5e36b',
    particles: 12, cloudScale: 0.9, ringRadius: 0, recoil: 5, shake: 0, textSize: 30,
    words: { burp: ['BURP', 'BUARP'], fart: ['PRRRT', 'FRRRT'] },
    scareBirds: false, celebrate: false,
  },
  {
    tier: 3, name: 'Powerful', label: 'Potente', color: '#ffd23f',
    particles: 20, cloudScale: 1.3, ringRadius: 110, recoil: 9, shake: 0.004, textSize: 38,
    words: { burp: ['¡BUUURP!', '¡BLOARP!'], fart: ['¡PRRRRAAT!', '¡BRRROOT!'] },
    scareBirds: false, celebrate: false,
  },
  {
    tier: 4, name: 'Massive', label: 'Masivo', color: '#ff9f1c',
    particles: 30, cloudScale: 1.8, ringRadius: 180, recoil: 14, shake: 0.008, textSize: 46,
    words: { burp: ['¡¡BUAAAARGH!!', '¡¡BROOOAARP!!'], fart: ['¡¡PRRROOOOM!!', '¡¡BRRRAAAAP!!'] },
    scareBirds: true, celebrate: false,
  },
  {
    tier: 5, name: 'Legendary', label: 'Legendario', color: '#ff4d6d',
    particles: 44, cloudScale: 2.4, ringRadius: 280, recoil: 20, shake: 0.013, textSize: 54,
    words: {
      burp: ['¡¡¡BUAAAAARRRGH!!!', '¡¡¡GROOOAAARP!!!', '¡¡¡BLUAAAAARGH!!!'],
      fart: ['¡¡¡PRRRROOOOMMM!!!', '¡¡¡BRRRRAAAAAAP!!!', '¡¡¡FRRRUUUUUM!!!'],
    },
    scareBirds: true, celebrate: true,
  },
];

/** Variantes de sonido por nivel (equivale a v01, v02, v03 en la convención de nombres). */
export const SOUND_VARIANTS_PER_TIER = 3;

export function getTierPresentation(tier: number): TierPresentation {
  return EMISSION_TIERS[Math.min(Math.max(tier, 1), EMISSION_TIERS.length) - 1];
}
