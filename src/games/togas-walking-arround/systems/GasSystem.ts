/** Aviso de que el medidor se ha llenado y toca soltar gas. */
export interface EmissionEvent {
  /** Número de emisión en la partida (1, 2, 3…). */
  index: number;
  /** Nivel de intensidad de esta emisión (1–maxTier). */
  tier: number;
}

/**
 * Medidor de gas: la mecánica central.
 *
 * - La comida suma, los antigases restan (sin bajar de 0).
 * - Al llegar al máximo hay una emisión y el sobrante se conserva.
 * - Cada emisión sube un nivel de intensidad hasta `maxTier`; los antigases NO lo bajan.
 */
export class GasSystem {
  current = 0;
  emissionCount = 0;
  /** Nivel alcanzado (0 = aún no ha habido emisiones). */
  intensityTier = 0;

  constructor(
    readonly maxGas = 100,
    readonly maxTier = 5,
  ) {}

  get ratio(): number {
    return this.current / this.maxGas;
  }

  /** Suma gas y devuelve las emisiones que se hayan disparado (normalmente 0 o 1). */
  add(amount: number): EmissionEvent[] {
    this.current += Math.max(0, amount);
    const emissions: EmissionEvent[] = [];
    while (this.current >= this.maxGas) {
      this.current -= this.maxGas;
      this.emissionCount++;
      this.intensityTier = Math.min(this.maxTier, this.emissionCount);
      emissions.push({ index: this.emissionCount, tier: this.intensityTier });
    }
    return emissions;
  }

  reduce(amount: number): void {
    this.current = Math.max(0, this.current - Math.max(0, amount));
  }

  reset(): void {
    this.current = 0;
    this.emissionCount = 0;
    this.intensityTier = 0;
  }
}
