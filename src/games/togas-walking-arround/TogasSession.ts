import Phaser from 'phaser';
import type { GameContext } from '../../core/contracts/GameContext';
import type { GameSession } from '../../core/contracts/GameSession';
import { GAME_CONFIG } from './config/game.config';
import { TogasRuntime, type WalkingMission } from './runtime';
import { BootScene } from './scenes/BootScene';
import { PlayScene } from './scenes/PlayScene';
import { ResultsScene } from './scenes/ResultsScene';
import { SelectScene } from './scenes/SelectScene';
import { GameHUD } from './ui/GameHUD';

/**
 * Una sesión = una instancia de Phaser.Game montada en el contenedor del shell.
 * Al destruirla se destruye el juego entero: texturas, escenas, tweens y listeners.
 */
export class TogasSession implements GameSession {
  private game: Phaser.Game | null = null;
  private readonly runtime: TogasRuntime;

  constructor(
    private readonly context: GameContext,
    mission: WalkingMission | null = null,
  ) {
    this.runtime = new TogasRuntime(context, mission);
  }

  start(): void {
    const rt = this.runtime;
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.context.container,
      width: GAME_CONFIG.view.width,
      height: GAME_CONFIG.view.height,
      backgroundColor: '#5fb8f5',
      banner: false,
      disableContextMenu: true,
      // El audio lo gestiona el AudioManager compartido, no Phaser.
      audio: { noAudio: true },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: { antialias: true, roundPixels: false },
      scene: [new BootScene(rt), new SelectScene(rt), new PlayScene(rt), new GameHUD(rt), new ResultsScene(rt)],
    });
  }

  pause(): void {
    this.game?.pause();
  }

  resume(): void {
    this.game?.resume();
  }

  destroy(): void {
    if (this.game) {
      this.game.resume();
      this.game.destroy(true);
      this.game = null;
    }
    this.runtime.dispose();
  }
}
