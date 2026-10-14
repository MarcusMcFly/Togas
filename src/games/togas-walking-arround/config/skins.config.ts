import type { CharacterLook } from '../art/character';

/** Parámetros del sintetizador de eructos. */
export interface BurpVoice {
  /** Frecuencia fundamental en Hz (más baja = más grave). */
  basePitch: number;
  /** Frecuencia del filtro que da el "color" de la voz. */
  formant: number;
  wave: OscillatorType;
  /** 0–1: cuánto "raspa" la garganta. */
  roughness: number;
}

/** Parámetros del sintetizador de pedos. */
export interface FartVoice {
  basePitch: number;
  /** Velocidad del "trrrr" en Hz. */
  flutter: number;
  wave: OscillatorType;
  /** 0–1: cuánto aire (ruido) lleva. */
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
      burp: { basePitch: 72, formant: 520, wave: 'sawtooth', roughness: 0.7 },
      fart: { basePitch: 58, flutter: 24, wave: 'sawtooth', breathiness: 0.45 },
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
      burp: { basePitch: 98, formant: 720, wave: 'square', roughness: 0.45 },
      fart: { basePitch: 76, flutter: 33, wave: 'square', breathiness: 0.7 },
    },
  },
];

export const DEFAULT_SKIN_ID = SKINS[0].id;

export function getSkin(id: string): SkinDefinition {
  return SKINS.find((skin) => skin.id === id) ?? SKINS[0];
}
