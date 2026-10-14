import type { RunnerParams } from '../systems/RunnerSystem';

/**
 * Parámetros generales de la partida. Cambia aquí el balance, no en la lógica.
 * Unidades: píxeles del mundo lógico (960 × 540) y segundos.
 */
export const GAME_CONFIG = {
  id: 'togas-walking-arround',
  view: { width: 960, height: 540 },
  session: {
    durationSec: 90,
    /** Pasos de la cuenta atrás antes de empezar ("3, 2, 1"). */
    countdownSteps: 3,
  },
  /** Línea del suelo (coordenada Y donde pisa el personaje). */
  groundY: 462,
  /** Posición horizontal del personaje, como fracción del ancho de pantalla. */
  playerAnchorX: 0.25,
  runner: {
    startSpeed: 230,
    maxSpeed: 400,
    gravity: 2400,
    /** Velocidad inicial del salto manteniendo pulsado (salto alto). */
    jumpVelocity: 920,
    /** Si se suelta pronto, la subida se corta a esta velocidad (salto corto). */
    minJumpVelocity: 650,
    /** Margen para saltar justo después de dejar el suelo. */
    coyoteTimeSec: 0.08,
    /** Una pulsación poco antes de aterrizar se recuerda y salta al tocar suelo. */
    jumpBufferSec: 0.12,
  } satisfies RunnerParams,
  /** Caja de colisión común a TODAS las skins: así ninguna tiene ventaja (AC-02). */
  playerHitbox: { width: 44, height: 100 },
  gas: { max: 100, maxTier: 5 },
} as const;
