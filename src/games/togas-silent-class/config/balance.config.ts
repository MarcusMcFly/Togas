/** Punto de control de la curva presión → dificultad del equilibrio. */
export interface BalanceCurvePoint {
  /** Presión (0–1) a la que se alcanzan estos valores. */
  pressure: number;
  /** Deriva del entorno (unidades/s) antes de dificultad y perks. */
  drift: number;
  /** Inestabilidad: cuanto más lejos del centro, más empuja hacia fuera (1/s). */
  instability: number;
}

export interface BalanceParams {
  safeThreshold: number;
  warningThreshold: number;
  criticalThreshold: number;
  stableDurationMs: number;
  /**
   * Margen extra que se tolera una vez ha empezado la confirmación: una burbuja que
   * roza el borde de la zona segura un instante no reinicia los 350 ms.
   */
  holdMargin: number;
  joystickDeadZone: number;
  perfectThreshold: number;
  correctionGain: number;
  /** Tiempo de respuesta (s) del mando: amortigua tirones y oscilaciones. */
  inputResponseSec: number;
  /** Curva continua presión → deriva/inestabilidad (se interpola suavemente entre puntos). */
  curve: readonly BalanceCurvePoint[];
  /** Tope de la velocidad (unidades/s) que el entorno puede imprimir a una burbuja. */
  maxDriftSpeed: number;
  /** Tope de la aceleración (unidades/s²) de esa deriva: nunca hay tirones. */
  maxDriftAccel: number;
  /** Segundos de calentamiento al empezar la clase: la deriva entra poco a poco. */
  warmupSec: number;
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
  holdMargin: 0.04,
  joystickDeadZone: 0.06,

  /** Por debajo de esto en ambos ejes, la liberación cuenta como "perfectamente centrada". */
  perfectThreshold: 0.07,
  /** Velocidad (unidades/s) que da el mando al máximo. */
  correctionGain: 1.5,
  inputResponseSec: 0.06,
  /**
   * Tabla del anexo 01 (IMP-02): fácil → moderado → exigente → difícil → crítico,
   * sin saltos en las fronteras. La corrección máxima (1,5 u/s) siempre dobla la deriva.
   */
  curve: [
    { pressure: 0, drift: 0.1, instability: 0.08 },
    { pressure: 0.25, drift: 0.16, instability: 0.14 },
    { pressure: 0.5, drift: 0.26, instability: 0.22 },
    { pressure: 0.75, drift: 0.38, instability: 0.3 },
    { pressure: 0.9, drift: 0.47, instability: 0.36 },
    { pressure: 1, drift: 0.54, instability: 0.4 },
  ],
  maxDriftSpeed: 0.7,
  maxDriftAccel: 2.4,
  warmupSec: 4,
  /** Sin apretar, la burbuja vaga y tiende suavemente al centro (1/s). */
  idleRelax: 0.7,
  /** Paso fijo de simulación: mismo resultado a 30, 60 o 144 FPS. */
  stepSec: 1 / 120,
  /** Frecuencias (Hz) de las perturbaciones: lentas y visibles, nunca bruscas. */
  disturbanceHz: [0.17, 0.31, 0.53],
};

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Deriva e inestabilidad para una presión (0–1). Continua y con pendiente suave. */
export function balanceCurve(curve: readonly BalanceCurvePoint[], pressure: number): { drift: number; instability: number } {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (pressure <= first.pressure) return { drift: first.drift, instability: first.instability };
  if (pressure >= last.pressure) return { drift: last.drift, instability: last.instability };
  let i = 1;
  while (curve[i].pressure < pressure) i++;
  const a = curve[i - 1];
  const b = curve[i];
  const t = smooth((pressure - a.pressure) / (b.pressure - a.pressure));
  return { drift: a.drift + (b.drift - a.drift) * t, instability: a.instability + (b.instability - a.instability) * t };
}
