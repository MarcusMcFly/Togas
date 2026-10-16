import { emissionTier, trumpetVariant, type EmissionTier, type TrumpetVariant } from '../config/scoring.config';

export interface ReleaseConditions {
  /** Ambas burbujas centradas durante el intervalo de confirmación. */
  stable: boolean;
  /** Ambas burbujas casi en el centro exacto. */
  perfect: boolean;
  pressure: number;
  /** Llegó a 100: no hay elección posible. */
  forced: boolean;
}

export type EmissionOutcome =
  | { kind: 'silent'; tier: EmissionTier; perfect: boolean; pressure: number }
  | { kind: 'trumpet'; variant: TrumpetVariant; intensity: number; label: string; forced: boolean; pressure: number };

/**
 * Decide si una liberación es silenciosa o un trompetazo. Solo mira el equilibrio y
 * la presión: si el profe la nota o no lo decide StealthSystem.
 */
export function resolveRelease(c: ReleaseConditions): EmissionOutcome {
  if (!c.forced && c.stable) {
    return { kind: 'silent', tier: emissionTier(c.pressure), perfect: c.perfect, pressure: c.pressure };
  }
  const v = trumpetVariant(c.forced ? 100 : c.pressure);
  return { kind: 'trumpet', variant: v.variant, intensity: v.intensity, label: v.label, forced: c.forced, pressure: c.pressure };
}
