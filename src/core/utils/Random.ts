/**
 * Generador pseudoaleatorio con semilla (mulberry32).
 * Con la misma semilla produce siempre la misma secuencia: imprescindible para tests reproducibles.
 */
export class Random {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed >>> 0 || 1;
  }

  /** Número en [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Entero en [min, max], ambos incluidos. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Elige un elemento con probabilidad proporcional a su peso. */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    let total = 0;
    for (const item of items) total += weightOf(item);
    let roll = this.next() * total;
    for (const item of items) {
      roll -= weightOf(item);
      if (roll < 0) return item;
    }
    return items[items.length - 1];
  }
}
