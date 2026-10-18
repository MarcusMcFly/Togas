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
 * Presión del gas (0–100). La clase empieza algo cargada y sube sola (más despacio
 * al principio); tras una emisión vuelve al valor inicial y hay un breve periodo de
 * recuperación en el que no sube.
 */
export class PressureSystem {
  private current: number;
  private recoveryLeft = 0;
  private cycleSec = 0;
  /** Segundos de clase transcurridos (para el arranque suave). */
  private sessionSec = 0;
  /** Mientras es `true`, la presión no pasa de `cap` (tutorial). */
  cap: number;

  constructor(private readonly params: PressureParams = PRESSURE_CONFIG) {
    this.current = params.sessionStartValue;
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

  /** Factor del arranque suave: de `rampFrom` a 1 en `rampSec`, con curva suave. */
  get ramp(): number {
    const { rampSec, rampFrom } = this.params;
    if (rampSec <= 0) return 1;
    const t = clamp(this.sessionSec / rampSec, 0, 1);
    return rampFrom + (1 - rampFrom) * t * t * (3 - 2 * t);
  }

  update(dt: number, rateScale: number): PressureUpdate {
    this.sessionSec += dt;
    if (this.recoveryLeft > 0) {
      this.recoveryLeft = Math.max(0, this.recoveryLeft - dt);
      return { forced: false, enteredCritical: false };
    }
    const wasCritical = this.state.id === 'critical';
    this.cycleSec += dt;
    const limit = Math.min(this.cap, this.params.max);
    this.current = clamp(this.current + this.params.baseRatePerSec * rateScale * this.ramp * dt, 0, limit);
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
