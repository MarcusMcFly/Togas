import type { GameModule } from '../../core/contracts/GameModule';
import { getThumbnail } from './art/thumbnail';
import { GAME_CONFIG } from './config/game.config';
import { SilentClassSession } from './SilentClassSession';

/** Punto de entrada del minijuego: lo único que ve el shell. */
export const togasSilentClass: GameModule = {
  id: GAME_CONFIG.id,
  title: 'Togas: Silent Class',
  version: '0.1.0',
  description: 'Equilibra piernas y glúteos con un dedo y suéltalo en silencio cuando el profe no mire.',
  get thumbnail() {
    return getThumbnail();
  },
  supportedInputs: ['touch', 'mouse', 'keyboard'],
  // Arte y sonido se generan por código: no hay nada que descargar.
  preload: () => Promise.resolve(),
  create: (context) => new SilentClassSession(context),
  destroy: () => undefined,
};
