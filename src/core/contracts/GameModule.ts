import type { GameContext } from './GameContext';
import type { GameSession } from './GameSession';

export type InputKind = 'keyboard' | 'touch' | 'mouse';

/**
 * Lo que un minijuego declara para que el shell pueda listarlo, cargarlo y cerrarlo
 * sin conocer nada de su interior.
 */
export interface GameModule {
  /** Identificador único y estable (kebab-case). Se usa en el registro y en las claves de guardado. */
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly description: string;
  /** URL de la miniatura del hub (normalmente un data URI). */
  readonly thumbnail: string;
  readonly supportedInputs: readonly InputKind[];
  /** Carga lo que el juego necesita antes de crear una sesión. */
  preload(): Promise<void>;
  /** Crea una sesión de juego. El shell llamará a `start()` justo después. */
  create(context: GameContext): GameSession;
  /** Libera los recursos que el módulo haya cacheado en `preload()`. */
  destroy(): void;
}
