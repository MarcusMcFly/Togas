/**
 * Identidad compartida de los personajes del universo Togas. Todos los minijuegos
 * usan las mismas skins: cada juego decide CÓMO dibujarlas y hacerlas sonar,
 * pero el aspecto (`look`) y la voz (`voice`) son comunes.
 *
 * Una skin cambia SOLO el aspecto y la voz, nunca la jugabilidad.
 */

/** Aspecto de una skin. Todo lo que el dibujo necesita saber de ella. */
export interface CharacterLook {
  skinTone: string;
  shirt: string;
  pants: string;
  shoes: string;
  backpack: string;
  /** `quiff`: pelo corto con tupé. */
  hair: 'bald' | 'thinning' | 'quiff';
  hairColor: string;
  stubble: boolean;
  /** Barba completa (del color del pelo). */
  beard?: boolean;
  /** Color del iris. Sin él, los ojos son solo pupila negra. */
  eyeColor?: string;
  /** Cejas arqueadas y media sonrisa ladeada: cara de tramar algo. */
  sly?: boolean;
  /** Símbolo de la camiseta. */
  emblem: string;
}

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
