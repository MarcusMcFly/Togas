import { clamp } from '../../../core/utils/math';

export interface RunnerParams {
  startSpeed: number;
  maxSpeed: number;
  gravity: number;
  jumpVelocity: number;
  minJumpVelocity: number;
  coyoteTimeSec: number;
  jumpBufferSec: number;
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

  private coyoteTimer = 0;
  private bufferTimer = 0;
  private jumpHeld = false;

  constructor(private readonly params: RunnerParams) {
    this.speed = params.startSpeed;
  }

  pressJump(): void {
    this.bufferTimer = this.params.jumpBufferSec;
    this.jumpHeld = true;
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

    this.speed = p.startSpeed + (p.maxSpeed - p.startSpeed) * clamp(progress, 0, 1);
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
      }
    }
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
