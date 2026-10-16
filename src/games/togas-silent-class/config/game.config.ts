/**
 * Parámetros generales de Togas: Silent Class. Cambia aquí el balance, no en la lógica.
 * Unidades: píxeles del mundo lógico (960 × 540) y segundos.
 */
export const GAME_CONFIG = {
  id: 'togas-silent-class',
  view: { width: 960, height: 540 },
  session: {
    durationSec: 90,
    countdownSteps: 3,
    maxStrikes: 3,
    /** Tras una emisión, ni sube la presión ni se aceptan intentos durante este tiempo. */
    recoverySec: 1.2,
    /** Un toque más corto que esto no cuenta como intento (evita pedos por accidente). */
    minHoldSec: 0.25,
  },
  /** Asiento del protagonista: origen de la nube y referencia de distancias. */
  playerSeat: { x: 480, y: 476 },
  /** Mando virtual: radio lógico que equivale a corrección máxima (igual en cualquier pantalla). */
  joystick: { radius: 70 },
  /** Fases de la sesión (segundos de inicio). La dificultad de cada una está en difficulty. */
  phases: [
    { id: 'settling', label: 'Primeros minutos', fromSec: 0 },
    { id: 'suspicion', label: 'Crece la sospecha', fromSec: 25 },
    { id: 'final', label: 'Examen final', fromSec: 60 },
  ],
} as const;

export type PhaseId = (typeof GAME_CONFIG.phases)[number]['id'];

export interface PhaseDifficulty {
  /** Multiplica la velocidad base de llenado de la presión. */
  pressureRate: number;
  /** Multiplica la deriva de las burbujas. */
  drift: number;
  /** Probabilidad de que una ventana tranquila acabe en un evento cómico. */
  eventChance: number;
  /** Duración (s) de las ventanas en las que el profe mira a la pizarra. */
  safeWindow: readonly [number, number];
  /** Duración (s) de las miradas a la clase. */
  facingWindow: readonly [number, number];
  /** Peso de "observar" frente a "explicar" cuando se gira. */
  watchWeight: number;
}

export const DIFFICULTY: Record<PhaseId, PhaseDifficulty> = {
  settling: { pressureRate: 0.82, drift: 0.75, eventChance: 0, safeWindow: [3.8, 5.5], facingWindow: [1.6, 2.4], watchWeight: 0.2 },
  suspicion: { pressureRate: 1, drift: 1, eventChance: 0.3, safeWindow: [2.8, 4.6], facingWindow: [1.8, 3], watchWeight: 0.45 },
  final: { pressureRate: 1.2, drift: 1.25, eventChance: 0.4, safeWindow: [2.4, 4], facingWindow: [2, 3.2], watchWeight: 0.6 },
};

/** Ajuste adaptativo: siempre acotado y comprobable en tests. */
export const ADAPTIVE = {
  /** Cada fallo seguido reduce la deriva este porcentaje… */
  driftReliefPerFailure: 0.08,
  /** …hasta este mínimo. */
  minDriftFactor: 0.76,
  /** A partir de esta racha de éxitos, la presión sube algo más rápido… */
  streakForPressure: 4,
  pressurePerExtraStreak: 0.05,
  /** …hasta este máximo. */
  maxPressureFactor: 1.15,
  /** Modo "relajado" (accesibilidad): menos deriva y presión más lenta. */
  forgiving: { drift: 0.72, pressureRate: 0.85 },
} as const;
