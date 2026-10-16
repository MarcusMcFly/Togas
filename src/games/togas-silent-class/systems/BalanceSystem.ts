import type { Random } from '../../../core/utils/Random';
import { clamp } from '../../../core/utils/math';
import type { BalanceParams } from '../config/balance.config';

export interface BalanceState {
  horizontal: number; // -1 a +1
  vertical: number; // -1 a +1 (positivo = arriba)
}

/** Entrada del mando ya normalizada: -1…+1 por eje. `active` = el dedo está apretando. */
export interface BalanceInput {
  active: boolean;
  x: number;
  y: number;
}

export type BalanceZone = 'safe' | 'drift' | 'warning' | 'critical';

interface Wave {
  hz: number;
  phase: number;
  weight: number;
}

/**
 * Las dos burbujas (piernas y glúteos). Cada eje se integra con paso fijo:
 *
 *   velocidad = perturbación(t) · deriva + mando · ganancia + inestabilidad · posición
 *
 * La perturbación es una suma de senos lentos con fases aleatorias: suave, visible y
 * función solo del tiempo, así que el resultado no depende de los FPS (GAME-013).
 */
export class BalanceSystem {
  readonly state: BalanceState = { horizontal: 0, vertical: 0 };
  private readonly waves: [Wave[], Wave[]];
  private time = 0;
  private accumulator = 0;
  private stableSec = 0;
  private centeredBefore = false;
  /** Suma ponderada por tiempo de la desviación, para la precisión media. */
  private deviationTime = 0;
  private deviationSum = 0;
  justStabilized = false;
  justLost = false;

  constructor(
    private readonly params: BalanceParams,
    rng: Random,
  ) {
    const axis = () => params.disturbanceHz.map((hz) => ({
      hz: hz * rng.range(0.85, 1.15),
      phase: rng.range(0, Math.PI * 2),
      weight: rng.range(0.6, 1),
    }));
    this.waves = [axis(), axis()];
  }

  /** Normaliza el desplazamiento del dedo (en unidades lógicas) con zona muerta. */
  static normalizeInput(dx: number, dy: number, radius: number, deadZone: number): { x: number; y: number } {
    const axis = (v: number) => {
      const n = clamp(v / radius, -1, 1);
      if (Math.abs(n) <= deadZone) return 0;
      return Math.sign(n) * ((Math.abs(n) - deadZone) / (1 - deadZone));
    };
    // Arrastrar hacia arriba (dy negativo en pantalla) sube la burbuja vertical.
    return { x: axis(dx), y: axis(-dy) };
  }

  /**
   * @param pressureRatio 0–1: más presión, más deriva e inestabilidad.
   * @param driftScale    dificultad, perks y ajustes adaptativos.
   */
  update(dt: number, input: BalanceInput, pressureRatio: number, driftScale: number): void {
    const p = this.params;
    const wasStable = this.isStable;
    this.accumulator += dt;
    while (this.accumulator >= p.stepSec) {
      this.accumulator -= p.stepSec;
      this.step(p.stepSec, input, pressureRatio, driftScale);
    }

    const centered = this.isCentered;
    this.stableSec = centered && input.active ? this.stableSec + dt : 0;
    this.justStabilized = !wasStable && this.isStable;
    this.justLost = this.centeredBefore && !centered && input.active;
    this.centeredBefore = centered;

    if (input.active && dt > 0) {
      this.deviationTime += dt;
      this.deviationSum += dt * (Math.abs(this.state.horizontal) + Math.abs(this.state.vertical)) / 2;
    }
  }

  private step(h: number, input: BalanceInput, pressureRatio: number, driftScale: number): void {
    const p = this.params;
    this.time += h;
    const drift = (p.baseDrift + p.pressureDrift * pressureRatio) * driftScale;
    const instability = p.instability + p.pressureInstability * pressureRatio;
    const values: [number, number] = [this.state.horizontal, this.state.vertical];
    const controls: [number, number] = [input.x, input.y];
    for (let axis = 0; axis < 2; axis++) {
      const x = values[axis];
      let velocity = this.disturbance(axis) * drift;
      if (input.active) velocity += controls[axis] * p.correctionGain + instability * x;
      else velocity -= p.idleRelax * x;
      values[axis] = clamp(x + velocity * h, -1, 1);
    }
    this.state.horizontal = values[0];
    this.state.vertical = values[1];
  }

  /** Perturbación en [-1, 1], solo función del tiempo. */
  private disturbance(axis: number): number {
    let sum = 0;
    let total = 0;
    for (const wave of this.waves[axis]) {
      sum += Math.sin(this.time * Math.PI * 2 * wave.hz + wave.phase) * wave.weight;
      total += wave.weight;
    }
    return sum / total;
  }

  zoneOf(value: number): BalanceZone {
    const v = Math.abs(value);
    const p = this.params;
    if (v < p.safeThreshold) return 'safe';
    if (v < p.warningThreshold) return 'drift';
    if (v < p.criticalThreshold) return 'warning';
    return 'critical';
  }

  get isCentered(): boolean {
    const t = this.params.safeThreshold;
    return Math.abs(this.state.horizontal) < t && Math.abs(this.state.vertical) < t;
  }

  /** Centrado durante el intervalo de confirmación (350 ms): condición para un pedo silencioso. */
  get isStable(): boolean {
    return this.stableSec * 1000 >= this.params.stableDurationMs;
  }

  /** 0–1: cuánto falta para confirmar la estabilidad (para el HUD). */
  get stability(): number {
    return clamp((this.stableSec * 1000) / this.params.stableDurationMs, 0, 1);
  }

  get isPerfect(): boolean {
    const t = this.params.perfectThreshold;
    return Math.abs(this.state.horizontal) < t && Math.abs(this.state.vertical) < t;
  }

  /** Precisión media ponderada por tiempo (0–1) durante el control activo. */
  get accuracy(): number {
    if (this.deviationTime <= 0) return 0;
    return clamp(1 - this.deviationSum / this.deviationTime, 0, 1);
  }

  get activeSeconds(): number {
    return this.deviationTime;
  }

  /** Tras una emisión: el cuerpo se recoloca, pero no se olvidan las estadísticas. */
  resetPosition(): void {
    this.state.horizontal = 0;
    this.state.vertical = 0;
    this.stableSec = 0;
    this.centeredBefore = false;
  }

  /** Suelta el control sin reiniciar posiciones (p. ej. al cancelar un toque). */
  releaseControl(): void {
    this.stableSec = 0;
    this.centeredBefore = false;
  }
}
