/**
 * Ciclo de vida de una partida. El shell es quien llama a estos métodos:
 *
 *   start() → [jugando] ⇄ pause()/resume() → destroy()
 *
 * `destroy()` debe dejarlo todo limpio: sin listeners, audio ni bucles huérfanos.
 */
export interface GameSession {
  start(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}
