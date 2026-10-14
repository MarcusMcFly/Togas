import type { CharacterLook } from '../art/character';

/** Parámetros del sintetizador de eructos (modelo de cuerdas vocales + boca). */
export interface BurpVoice {
  /** Tono de las cuerdas vocales en Hz (más bajo = más grave). */
  basePitch: number;
  /** Formantes F1 y F2 de la vocal abierta ("aaa"): el timbre de la boca. */
  formants: readonly [number, number];
  /** 0–1: voz rota, irregular ("creaky voice"). */
  roughness: number;
  /** 0–1: gorgoteo de garganta. */
  gurgle: number;
}

/** Parámetros del sintetizador de pedos (modelo de válvula que aletea + resonancia). */
export interface FartVoice {
  /** Velocidad de aleteo en Hz: el "trrrr". */
  basePitch: number;
  /** Frecuencia de resonancia del "cuerpo" del sonido. */
  resonance: number;
  /** 0–1: chasquidos húmedos. */
  wetness: number;
  /** 0–1: cuánto aire escapa (ruido). */
  breathiness: number;
}

/**
 * Una skin cambia SOLO el aspecto y la voz. La física y la caja de colisión
 * son comunes y viven en game.config.ts.
 *
 * Para añadir una skin: añade una entrada aquí. Las animaciones se generan
 * automáticamente a partir de `look`, y los sonidos a partir de `voice`.
 */
export interface SkinDefinition {
  id: string;
  displayName: string;
  tagline: string;
  /** Altura de referencia en metros: escala el dibujo, no la colisión. */
  heightM: number;
  look: CharacterLook;
  voice: { burp: BurpVoice; fart: FartVoice };
}

/** Altura que se dibuja a escala 1. */
export const REFERENCE_HEIGHT_M = 1.8;

export const SKINS: readonly SkinDefinition[] = [
  {
    id: 'poio',
    displayName: 'Poio',
    tagline: '1,80 m · Calvo y fuerte',
    heightM: 1.8,
    look: {
      skinTone: '#f1c08e',
      shirt: '#e76f51',
      pants: '#3d5a80',
      shoes: '#f4f1ea',
      backpack: '#2a9d8f',
      hair: 'bald',
      hairColor: '#3b2a20',
      stubble: true,
      emblem: '∫',
    },
    voice: {
      // Grave y rasposo: un eructo de bajo profundo.
      burp: { basePitch: 66, formants: [520, 950], roughness: 0.75, gurgle: 0.55 },
      // Lento y retumbante, poco húmedo.
      fart: { basePitch: 48, resonance: 170, wetness: 0.3, breathiness: 0.3 },
    },
  },
  {
    id: 'marcus',
    displayName: 'Marcus',
    tagline: '1,72 m · Poco pelo, mucha fuerza',
    heightM: 1.72,
    look: {
      skinTone: '#e2a66f',
      shirt: '#457b9d',
      pants: '#2b2d42',
      shoes: '#e63946',
      backpack: '#f4a261',
      hair: 'thinning',
      hairColor: '#4a3426',
      stubble: false,
      emblem: 'π',
    },
    voice: {
      // Más agudo y "vocal": un BUAAARP con mucha boca.
      burp: { basePitch: 94, formants: [680, 1180], roughness: 0.45, gurgle: 0.35 },
      // Más rápido, húmedo y con más aire.
      fart: { basePitch: 68, resonance: 240, wetness: 0.65, breathiness: 0.55 },
    },
  },
];

export const DEFAULT_SKIN_ID = SKINS[0].id;

export function getSkin(id: string): SkinDefinition {
  return SKINS.find((skin) => skin.id === id) ?? SKINS[0];
}
