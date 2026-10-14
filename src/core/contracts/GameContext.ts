import type { AudioManager } from '../services/AudioManager';
import type { InputManager } from '../services/InputManager';
import type { SaveScope } from '../services/SaveManager';
import type { SettingsManager } from '../services/SettingsManager';

/** Servicios compartidos que el shell presta a cada juego (inyección de dependencias). */
export interface GameServices {
  readonly input: InputManager;
  readonly audio: AudioManager;
  readonly settings: SettingsManager;
  /** Almacenamiento persistente reservado para este juego (récords, skin elegida…). */
  readonly storage: SaveScope;
}

/** La "caja de herramientas" que recibe un juego al crearse. */
export interface GameContext {
  /** Elemento DOM donde el juego monta su canvas. El shell lo elimina al salir. */
  readonly container: HTMLElement;
  readonly services: GameServices;
  /** Pide al shell volver al hub. El shell se encarga de llamar a `destroy()`. */
  exit(): void;
  /** Muestra u oculta el botón de pausa del shell (en menús no tiene sentido). */
  setPauseAvailable(available: boolean): void;
}
