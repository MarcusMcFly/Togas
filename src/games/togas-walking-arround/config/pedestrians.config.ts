import type { PersonLook } from '../art/pedestrian';

/**
 * Viandantes: decorado que reacciona a los pedos. Puro efecto cómico:
 * no afectan a la puntuación, al gas ni a la física.
 */
export type ReactionType = 'surprise' | 'anger' | 'flee';

export interface PedestrianLook extends PersonLook {
  id: string;
  /** Escala respecto al tamaño de referencia (variedad de alturas). */
  scale: number;
}

export const PEDESTRIAN_LOOKS: readonly PedestrianLook[] = [
  {
    id: 'senora', scale: 0.92, skinTone: '#f3c9a0', hair: 'bun', hairColor: '#8a8a8a',
    top: '#b5179e', bottom: '#3a0ca3', skirt: true, shoes: '#2b2340', glasses: true,
  },
  {
    id: 'abuelo', scale: 0.95, skinTone: '#e8b48a', hair: 'grey', hairColor: '#d9d9d9',
    top: '#6c757d', bottom: '#4a4e69', skirt: false, shoes: '#5c3d2e', glasses: false,
  },
  {
    id: 'corredora', scale: 1, skinTone: '#c68642', hair: 'ponytail', hairColor: '#2b1a12',
    top: '#06d6a0', bottom: '#073b4c', skirt: false, shoes: '#ffffff', glasses: false,
  },
  {
    id: 'rapero', scale: 1.02, skinTone: '#8d5524', hair: 'cap', hairColor: '#ef476f',
    top: '#ffd166', bottom: '#264653', skirt: false, shoes: '#ffffff', glasses: false,
  },
  {
    id: 'hipster', scale: 1.04, skinTone: '#f1c27d', hair: 'curly', hairColor: '#7f4f24',
    top: '#e76f51', bottom: '#2a9d8f', skirt: false, shoes: '#3d405b', glasses: true,
  },
];

/** Agentes (ficticios) que se llevan detenido al protagonista en la campaña. */
export const POLICE_LOOKS: readonly PedestrianLook[] = [
  {
    id: 'agente1', scale: 1.04, skinTone: '#e8b48a', hair: 'cap', hairColor: '#1d3557',
    top: '#274c77', bottom: '#1d2d44', skirt: false, shoes: '#111111', glasses: false,
  },
  {
    id: 'agente2', scale: 1.02, skinTone: '#c68642', hair: 'cap', hairColor: '#1d3557',
    top: '#274c77', bottom: '#1d2d44', skirt: false, shoes: '#111111', glasses: true,
  },
];

export const PEDESTRIAN_CONFIG = {
  /** Distancia de mundo entre apariciones [mín, máx]. */
  spawnEvery: [900, 2000] as const,
  /** Velocidad de paseo hacia el jugador (px/s de mundo) [mín, máx]. */
  walkSpeed: [25, 55] as const,
  maxActive: 4,
  /** Radio de reacción alrededor del jugador: crece con la intensidad del pedo. */
  reactionRadius: { base: 240, perTier: 90 },
  /** Cuánto dura la sorpresa o el cabreo antes de seguir andando. */
  reactionMs: 1600,
  /** Velocidad al huir (px/s de mundo). */
  fleeSpeed: 520,
  /** La onda llega antes a quien está más cerca: retraso por píxel de distancia. */
  delayPerPixelMs: 1.2,
  /** Probabilidad relativa de cada reacción según el nivel del pedo (índice = nivel − 1). */
  reactionWeights: [
    { surprise: 6, anger: 3, flee: 1 },
    { surprise: 5, anger: 4, flee: 1 },
    { surprise: 3, anger: 4, flee: 3 },
    { surprise: 2, anger: 3, flee: 5 },
    { surprise: 1, anger: 2, flee: 7 },
  ] as const satisfies ReadonlyArray<Record<ReactionType, number>>,
  words: {
    surprise: ['¡¿?!', '¡Ostras!', '¡Madre mía!'],
    anger: ['¡#@%!', '¡Guarro!', '¡Qué asco!'],
    flee: ['¡Socorro!', '¡Aire!', '¡Huyan!'],
  } satisfies Record<ReactionType, readonly string[]>,
} as const;
