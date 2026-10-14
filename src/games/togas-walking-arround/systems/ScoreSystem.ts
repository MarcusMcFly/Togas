import type { EmissionType } from './EmissionSystem';

export interface SessionStats {
  score: number;
  /** Unidades recogidas por tipo de comida. */
  collected: Record<string, number>;
  totalCollected: number;
  obstaclesHit: number;
  burps: number;
  farts: number;
  maxTier: number;
}

/**
 * Puntuación y estadísticas de la partida.
 * Es independiente de la intensidad: un eructo legendario no da más puntos.
 */
export class ScoreSystem {
  private stats: SessionStats;

  constructor(private readonly collectibleIds: readonly string[]) {
    this.stats = this.empty();
  }

  get score(): number {
    return this.stats.score;
  }

  /** `multiplier` queda preparado para bonus futuros sin tocar las definiciones de comida. */
  addCollectible(id: string, points: number, multiplier = 1): void {
    this.stats.score += Math.round(points * multiplier);
    this.stats.collected[id] = (this.stats.collected[id] ?? 0) + 1;
    this.stats.totalCollected++;
  }

  /** Los antigases restan gas, nunca puntos. */
  recordObstacleHit(): void {
    this.stats.obstaclesHit++;
  }

  recordEmission(type: EmissionType, tier: number): void {
    if (type === 'burp') this.stats.burps++;
    else this.stats.farts++;
    this.stats.maxTier = Math.max(this.stats.maxTier, tier);
  }

  snapshot(): SessionStats {
    return { ...this.stats, collected: { ...this.stats.collected } };
  }

  reset(): void {
    this.stats = this.empty();
  }

  private empty(): SessionStats {
    const collected: Record<string, number> = {};
    for (const id of this.collectibleIds) collected[id] = 0;
    return { score: 0, collected, totalCollected: 0, obstaclesHit: 0, burps: 0, farts: 0, maxTier: 0 };
  }
}
