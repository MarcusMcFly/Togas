import type { GameModule } from '../../core/contracts/GameModule';
import { getThumbnail } from './art/thumbnail';
import { GAME_CONFIG } from './config/game.config';
import { TogasSession } from './TogasSession';

/** Punto de entrada del minijuego: lo único que ve el shell. */
export const togasWalkingArround: GameModule = {
  id: GAME_CONFIG.id,
  title: 'Togas Walking arround',
  version: '0.1.0',
  description: 'Corre por la ciudad, come fabes y desata eructos legendarios. Solo hace falta un dedo.',
  get thumbnail() {
    return getThumbnail();
  },
  supportedInputs: ['keyboard', 'touch', 'mouse'],
  // Todo el arte y el sonido se generan por código: no hay nada que descargar.
  preload: () => Promise.resolve(),
  create: (context) => new TogasSession(context),
  destroy: () => undefined,
};
