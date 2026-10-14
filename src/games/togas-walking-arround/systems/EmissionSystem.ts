import type { Random } from '../../../core/utils/Random';
import type { EmissionEvent } from './GasSystem';

export type EmissionType = 'burp' | 'fart';

/** Regla que decide si toca eructo o pedo. Se puede sustituir por otra más elaborada. */
export type EmissionPolicy = (emissionIndex: number) => EmissionType;

/** Regla inicial de la spec: alternar, empezando por eructo. */
export const alternatingPolicy: EmissionPolicy = (index) => (index % 2 === 1 ? 'burp' : 'fart');

export interface Emission {
  index: number;
  tier: number;
  type: EmissionType;
  /** Variante de sonido (0 = v01, 1 = v02…). */
  variant: number;
}

/**
 * Convierte un aviso del GasSystem en una emisión concreta: tipo y variante.
 * No reproduce nada: quien la reciba decide qué sonido y qué efectos aplicar
 * según la skin activa.
 */
export class EmissionSystem {
  constructor(
    private readonly variantsPerTier: number,
    private readonly rng: Random,
    private readonly policy: EmissionPolicy = alternatingPolicy,
  ) {}

  resolve(event: EmissionEvent): Emission {
    return {
      index: event.index,
      tier: event.tier,
      type: this.policy(event.index),
      variant: this.rng.int(0, this.variantsPerTier - 1),
    };
  }
}
