import type { StreetRules } from '../config/ruleset';

/** Qué ha pasado con una emisión en plena calle. */
export interface EmissionVerdict {
  /** Nadie la ha olido. */
  clean: boolean;
  witnesses: number;
  /** Multiplicador tras la emisión. */
  multiplier: number;
  wanted: number;
  arrested: boolean;
  /** Puntos que cuesta (solo con penalización por puntos; 0 si fue limpia). */
  pointsPenalty: number;
}

/**
 * Reglas de la calle (sin Phaser): un pedo sin testigos sube el multiplicador y da un
 * acelerón; con testigos, el multiplicador vuelve a ×1 y, según el reglamento, sube la
 * búsqueda policial (con `maxWanted` estrellas, detenido) o se pierden puntos.
 */
export class StreetSystem {
  multiplier: number;
  bestMultiplier: number;
  wanted = 0;
  /** Velocidad extra actual (px/s); baja sola con el tiempo. */
  boost = 0;
  cleanEmissions = 0;
  /** Pedos con testigos. */
  witnessedEmissions = 0;
  pedestriansAffected = 0;

  constructor(private readonly rules: StreetRules) {
    this.multiplier = rules.multiplier.start;
    this.bestMultiplier = this.multiplier;
  }

  get arrested(): boolean {
    const penalty = this.rules.witnessPenalty;
    return penalty.kind === 'police' && this.wanted >= penalty.maxWanted;
  }

  /** Estrellas con las que te detienen (0 si no hay policía). */
  get maxWanted(): number {
    const penalty = this.rules.witnessPenalty;
    return penalty.kind === 'police' ? penalty.maxWanted : 0;
  }

  /** Puntos de una comida: base × multiplicador de la comida × multiplicador de emisiones. */
  points(base: number, itemMultiplier: number): number {
    return Math.round(base * itemMultiplier * this.multiplier);
  }

  resolveEmission(witnesses: number): EmissionVerdict {
    const { multiplier, speedBoost, witnessPenalty } = this.rules;
    const clean = witnesses <= 0 && !this.arrested;
    let pointsPenalty = 0;
    if (clean) {
      this.cleanEmissions++;
      this.multiplier = Math.min(multiplier.max, round2(this.multiplier + multiplier.step));
      this.bestMultiplier = Math.max(this.bestMultiplier, this.multiplier);
      this.boost += speedBoost.perEmission;
    } else {
      this.witnessedEmissions++;
      this.pedestriansAffected += Math.max(0, witnesses);
      this.multiplier = multiplier.start;
      if (witnessPenalty.kind === 'police') this.wanted = Math.min(witnessPenalty.maxWanted, this.wanted + 1);
      else pointsPenalty = witnessPenalty.points;
    }
    return { clean, witnesses, multiplier: this.multiplier, wanted: this.wanted, arrested: this.arrested, pointsPenalty };
  }

  /** Tropiezo con un obstáculo: se pierden el multiplicador y el acelerón. */
  stumble(): void {
    this.multiplier = this.rules.multiplier.start;
    this.boost = 0;
  }

  update(dt: number): void {
    this.boost = Math.max(0, this.boost - this.rules.speedBoost.decayPerSec * dt);
  }
}

const round2 = (v: number): number => Math.round(v * 100) / 100;
