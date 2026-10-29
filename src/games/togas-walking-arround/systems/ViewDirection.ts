import { GAME_CONFIG } from '../config/game.config';

/**
 * Sentido de la marcha en pantalla. Toda la lógica (distancia, spawn, colisiones,
 * testigos) trabaja siempre "hacia delante"; solo al dibujar se refleja la X si se
 * avanza hacia la izquierda. Así ningún sistema necesita saber hacia dónde se va.
 */
export class ViewDirection {
  constructor(
    readonly reversed = false,
    private readonly width: number = GAME_CONFIG.view.width,
  ) {}

  /** +1 si se avanza hacia la derecha, -1 si hacia la izquierda. */
  get facing(): 1 | -1 {
    return this.reversed ? -1 : 1;
  }

  /** X lógica (sentido de avance) → X de pantalla. Sirve también a la inversa. */
  x(logicalX: number): number {
    return this.reversed ? this.width - logicalX : logicalX;
  }

  /** Un sentido lógico (+1 avanza, -1 retrocede) en pantalla. */
  dir(logical: number): number {
    return logical * this.facing;
  }
}

export const FORWARD_VIEW = new ViewDirection(false);
