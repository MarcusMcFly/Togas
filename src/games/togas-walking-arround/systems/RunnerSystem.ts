import { clamp } from '../../../core/utils/math';

export interface RunnerParams {
  startSpeed: number;
  maxSpeed: number;
  gravity: number;
  jumpVelocity: number;
  minJumpVelocity: number;
  coyoteTimeSec: number;
  jumpBufferSec: number;
  /** Rodar (opcional): duración y velocidad de caída rápida si se pide en el aire. */
  roll?: { durationSec: number; fastFallVelocity: number };
}

/**
 * Avance automático y salto de altura variable.
 *
 * Trabaja con la altura sobre el suelo (`height`, hacia arriba) en lugar de la Y de
 * pantalla, así la física no depende de cómo se dibuje. El salto variable usa la
 * técnica de "cortar la subida": si se suelta pronto, la velocidad hacia arriba se
 * recorta a `minJumpVelocity`.
 */
export class RunnerSystem {
  height = 0;
  /** Velocidad vertical (positiva = hacia arriba). */
  velocityY = 0;
  grounded = true;
  /** Distancia horizontal recorrida en píxeles de mundo. */
  distance = 0;
  speed: number;
  /** Se activan durante un único `update()`, útiles para animaciones y sonidos. */
  justJumped = false;
  justLanded = false;
  justRolled = false;
  /** Rodando: la caja de colisión es más baja. */
  rolling = false;
  /** Velocidad extra (acelerones) que se suma a la de la partida. */
  speedBonus = 0;
  /** Tope de velocidad, acelerones incluidos. */
  speedCap = Number.POSITIVE_INFINITY;

  private coyoteTimer = 0;
  private bufferTimer = 0;
  private jumpHeld = false;
  private rollTimer = 0;
  private rollQueued = false;

  constructor(private readonly params: RunnerParams) {
    this.speed = params.startSpeed;
  }

  pressJump(): void {
    this.bufferTimer = this.params.jumpBufferSec;
    this.jumpHeld = true;
  }

  /** Rodar. En el aire, cae rápido y rueda al aterrizar. Sin parámetros de rodar no hace nada. */
  pressRoll(): void {
    const roll = this.params.roll;
    if (!roll) return;
    this.bufferTimer = 0;
    if (this.grounded) {
      this.startRoll(roll.durationSec);
      return;
    }
    this.rollQueued = true;
    this.velocityY = Math.min(this.velocityY, -roll.fastFallVelocity);
  }

  releaseJump(): void {
    this.jumpHeld = false;
    if (this.velocityY > this.params.minJumpVelocity) this.velocityY = this.params.minJumpVelocity;
  }

  /**
   * @param dt segundos desde el último paso
   * @param progress avance de la partida de 0 a 1 (controla la velocidad)
   */
  update(dt: number, progress: number): void {
    const p = this.params;
    this.justJumped = false;
    this.justLanded = false;
    this.justRolled = false;

    const base = p.startSpeed + (p.maxSpeed - p.startSpeed) * clamp(progress, 0, 1);
    this.speed = Math.min(this.speedCap, base + this.speedBonus);
    this.distance += this.speed * dt;

    this.coyoteTimer = this.grounded ? p.coyoteTimeSec : this.coyoteTimer - dt;

    if (this.bufferTimer > 0) {
      this.bufferTimer -= dt;
      if (this.coyoteTimer > 0) {
        this.velocityY = this.jumpHeld ? p.jumpVelocity : p.minJumpVelocity;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.bufferTimer = 0;
        this.justJumped = true;
        // Saltar interrumpe el rodar.
        this.rolling = false;
        this.rollTimer = 0;
      }
    }

    if (!this.grounded) {
      this.velocityY -= p.gravity * dt;
      this.height += this.velocityY * dt;
      if (this.height <= 0) {
        this.height = 0;
        this.velocityY = 0;
        this.grounded = true;
        this.justLanded = true;
        if (this.rollQueued && p.roll) this.startRoll(p.roll.durationSec);
      }
    }

    if (this.rolling) {
      this.rollTimer -= dt;
      if (this.rollTimer <= 0) {
        this.rolling = false;
        this.rollTimer = 0;
      }
    }
  }

  private startRoll(durationSec: number): void {
    this.rollQueued = false;
    this.rolling = true;
    this.rollTimer = durationSec;
    this.justRolled = true;
  }

  reset(): void {
    this.height = 0;
    this.velocityY = 0;
    this.grounded = true;
    this.distance = 0;
    this.speed = this.params.startSpeed;
    this.justJumped = false;
    this.justLanded = false;
    this.coyoteTimer = 0;
    this.bufferTimer = 0;
    this.jumpHeld = false;
    this.justRolled = false;
    this.rolling = false;
    this.rollTimer = 0;
    this.rollQueued = false;
    this.speedBonus = 0;
  }
}

/** Altura máxima del salto para una velocidad inicial dada: v² / 2g. */
export function jumpApex(params: RunnerParams, velocity = params.jumpVelocity): number {
  return (velocity * velocity) / (2 * params.gravity);
}

/** Tiempo en el aire de un salto completo: 2v / g. */
export function airTime(params: RunnerParams, velocity = params.jumpVelocity): number {
  return (2 * velocity) / params.gravity;
}

/**
 * Distancia mínima (de centro a centro) entre dos obstáculos para que siempre se puedan
 * esquivar ambos, incluso a velocidad máxima y con el salto más largo.
 */
export function minObstacleGap(
  params: RunnerParams,
  playerWidth: number,
  obstacleWidth: number,
  margin: number,
): number {
  return airTime(params) * params.maxSpeed + playerWidth + obstacleWidth + margin;
}
