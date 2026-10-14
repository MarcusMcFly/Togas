import { lerp } from '../../../core/utils/math';
import type { Random } from '../../../core/utils/Random';

export type Lane = 'ground' | 'low' | 'mid' | 'high';

export type PatternSlot =
  | { kind: 'collectible'; dx: number; lane: Lane }
  | { kind: 'obstacle'; dx: number };

export interface SpawnPattern {
  id: string;
  weight: number;
  /** El patrón no aparece hasta este punto de la partida (0–1). */
  minProgress?: number;
  slots: readonly PatternSlot[];
}

export interface SpawnConfig {
  leadIn: number;
  gapStart: readonly [number, number];
  gapEnd: readonly [number, number];
  obstacleMargin: number;
  lanes: Readonly<Record<Lane, number>>;
  patterns: readonly SpawnPattern[];
}

export interface SpawnCatalogEntry {
  id: string;
  spawnWeight: number;
}

export interface SpawnRequest {
  kind: 'collectible' | 'obstacle';
  typeId: string;
  /** Posición X (centro) en coordenadas de mundo. */
  x: number;
  /** Altura sobre el suelo: centro para comida, 0 para obstáculos (apoyados en el suelo). */
  height: number;
}

/**
 * Generación procedural y justa del recorrido.
 *
 * Encadena patrones al azar. Regla de oro: entre dos obstáculos siempre hay al menos
 * `minObstacleGap` píxeles, así nunca hay combinaciones imposibles de esquivar (AC-14).
 * Con la misma semilla genera siempre lo mismo (tests reproducibles).
 */
export class SpawnSystem {
  private nextX: number;
  private lastObstacleX = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly config: SpawnConfig,
    private readonly collectibles: readonly SpawnCatalogEntry[],
    private readonly obstacles: readonly SpawnCatalogEntry[],
    private readonly rng: Random,
    readonly minObstacleGap: number,
  ) {
    this.nextX = config.leadIn;
  }

  /** Añade a `out` todo lo que haya que crear hasta `horizonX` (normalmente el borde derecho de la pantalla). */
  update(horizonX: number, progress: number, out: SpawnRequest[]): void {
    while (this.nextX <= horizonX) this.placePattern(progress, out);
  }

  private placePattern(progress: number, out: SpawnRequest[]): void {
    const pattern = this.choosePattern(progress);
    let start = this.nextX;

    // Si el patrón trae un obstáculo demasiado cerca del anterior, se retrasa entero.
    let firstObstacleDx = Number.POSITIVE_INFINITY;
    for (const slot of pattern.slots) if (slot.kind === 'obstacle') firstObstacleDx = Math.min(firstObstacleDx, slot.dx);
    if (Number.isFinite(firstObstacleDx)) {
      const earliest = this.lastObstacleX + this.minObstacleGap - firstObstacleDx;
      if (start < earliest) start = earliest;
    }

    let width = 0;
    for (const slot of pattern.slots) {
      const x = start + slot.dx;
      width = Math.max(width, slot.dx);
      if (slot.kind === 'obstacle') {
        out.push({ kind: 'obstacle', typeId: this.pickType(this.obstacles), x, height: 0 });
        this.lastObstacleX = Math.max(this.lastObstacleX, x);
      } else {
        out.push({ kind: 'collectible', typeId: this.pickType(this.collectibles), x, height: this.config.lanes[slot.lane] });
      }
    }

    const minGap = lerp(this.config.gapStart[0], this.config.gapEnd[0], progress);
    const maxGap = lerp(this.config.gapStart[1], this.config.gapEnd[1], progress);
    this.nextX = start + width + this.rng.range(minGap, maxGap);
  }

  private choosePattern(progress: number): SpawnPattern {
    const eligible = this.config.patterns.filter((p) => (p.minProgress ?? 0) <= progress);
    return this.rng.weighted(eligible, (p) => p.weight);
  }

  private pickType(catalog: readonly SpawnCatalogEntry[]): string {
    return this.rng.weighted(catalog, (entry) => entry.spawnWeight).id;
  }
}
