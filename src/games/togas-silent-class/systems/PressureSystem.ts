import { clamp } from '../../../core/utils/math';
import { PRESSURE_CONFIG, pressureState, type PressureState } from '../config/pressure.config';

export type PressureParams = typeof PRESSURE_CONFIG;

export interface PressureUpdate {
  /** Ha llegado al máximo: emisión forzada. */
  forced: boolean;
  /** Acaba de entrar en estado crítico. */
  enteredCritical: boolean;
}

/**
 * Presión del gas (0–100). Sube sola durante cada ciclo; tras una emisión vuelve al
 * valor inicial y hay un breve periodo de recuperación en el que no sube.
 */
export class PressureSystem {
  private current: number;
  private recoveryLeft = 0;
  private cycleSec = 0;
  /** Mientras es `true`, la presión no pasa de `cap` (tutorial). */
  cap: number;

  constructor(private readonly params: PressureParams = PRESSURE_CONFIG) {
    this.current = params.startValue;
    this.cap = params.max;
  }

  get value(): number {
    return this.current;
  }

  get ratio(): number {
    return this.current / this.params.max;
  }

  get state(): PressureState {
    return pressureState(this.current);
  }

  get inRecovery(): boolean {
    return this.recoveryLeft > 0;
  }

  /** Segundos que lleva aguantando el gas en este ciclo. */
  get holdSec(): number {
    return this.cycleSec;
  }

  update(dt: number, rateScale: number): PressureUpdate {
    if (this.recoveryLeft > 0) {
      this.recoveryLeft = Math.max(0, this.recoveryLeft - dt);
      return { forced: false, enteredCritical: false };
    }
    const wasCritical = this.state.id === 'critical';
    this.cycleSec += dt;
    const limit = Math.min(this.cap, this.params.max);
    this.current = clamp(this.current + this.params.baseRatePerSec * rateScale * dt, 0, limit);
    return {
      forced: this.current >= this.params.max,
      enteredCritical: !wasCritical && this.state.id === 'critical',
    };
  }

  /** Tras una emisión: vuelta al valor inicial y recuperación. */
  vent(recoverySec: number): void {
    this.current = this.params.startValue;
    this.cycleSec = 0;
    this.recoveryLeft = recoverySec;
  }
}
