import type { Random } from '../../../core/utils/Random';

export interface StrikeResult {
  strikes: number;
  /** La Silla Insonorizada se ha comido este aviso. */
  absorbed: boolean;
  expelled: boolean;
}

/**
 * Avisos del profesor. Tres avisos = expulsión.
 * - Trompetazo: siempre es aviso (salvo el primero con la Silla Insonorizada).
 * - Silencioso con el profe mirando: aviso con la probabilidad que indique ProfessorAI.
 * - Silencioso con el profe de espaldas: nunca.
 */
export class StealthSystem {
  private count = 0;
  private chairAvailable: boolean;

  constructor(
    private readonly maxStrikes: number,
    private readonly rng: Random,
    soundproofChair: boolean,
  ) {
    this.chairAvailable = soundproofChair;
  }

  get strikes(): number {
    return this.count;
  }

  get remaining(): number {
    return Math.max(0, this.maxStrikes - this.count);
  }

  get expelled(): boolean {
    return this.count >= this.maxStrikes;
  }

  /** ¿Nota el profe una liberación silenciosa? */
  noticesSilent(detectionChance: number): boolean {
    if (detectionChance <= 0) return false;
    if (detectionChance >= 1) return true;
    return this.rng.chance(detectionChance);
  }

  strike(reason: 'trumpet' | 'seen'): StrikeResult {
    if (reason === 'trumpet' && this.chairAvailable) {
      this.chairAvailable = false;
      return { strikes: this.count, absorbed: true, expelled: false };
    }
    this.count = Math.min(this.maxStrikes, this.count + 1);
    return { strikes: this.count, absorbed: false, expelled: this.expelled };
  }
}
