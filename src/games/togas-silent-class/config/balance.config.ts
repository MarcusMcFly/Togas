export interface BalanceParams {
  safeThreshold: number;
  warningThreshold: number;
  criticalThreshold: number;
  stableDurationMs: number;
  joystickDeadZone: number;
  perfectThreshold: number;
  correctionGain: number;
  baseDrift: number;
  pressureDrift: number;
  instability: number;
  pressureInstability: number;
  idleRelax: number;
  stepSec: number;
  disturbanceHz: readonly number[];
}

/**
 * Niveles de burbuja (piernas = horizontal, glúteos = vertical).
 * Posiciones normalizadas de -1 a +1; 0 es el equilibrio perfecto.
 */
export const BALANCE_CONFIG: Readonly<BalanceParams> = {
  // Valores iniciales de la spec.
  safeThreshold: 0.18,
  warningThreshold: 0.65,
  criticalThreshold: 0.9,
  stableDurationMs: 350,
  joystickDeadZone: 0.06,

  /** Por debajo de esto en ambos ejes, la liberación cuenta como "perfectamente centrada". */
  perfectThreshold: 0.07,
  /** Velocidad (unidades/s) que da el mando al máximo. */
  correctionGain: 1.5,
  /** Deriva del entorno (unidades/s) sin presión y extra con presión máxima. */
  baseDrift: 0.22,
  pressureDrift: 0.5,
  /** Inestabilidad: cuanto más lejos del centro, más empuja hacia fuera (1/s). */
  instability: 0.3,
  pressureInstability: 0.5,
  /** Sin apretar, la burbuja vaga y tiende suavemente al centro (1/s). */
  idleRelax: 0.7,
  /** Paso fijo de simulación: mismo resultado a 30, 60 o 144 FPS. */
  stepSec: 1 / 120,
  /** Frecuencias (Hz) de las perturbaciones: lentas y visibles, nunca bruscas. */
  disturbanceHz: [0.17, 0.31, 0.53],
};
