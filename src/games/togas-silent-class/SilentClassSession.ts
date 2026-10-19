import Phaser from 'phaser';
import type { GameContext } from '../../core/contracts/GameContext';
import type { GameSession } from '../../core/contracts/GameSession';
import { GAME_CONFIG } from './config/game.config';
import { SilentClassRuntime, type ClassroomMission } from './runtime';
import { BootScene } from './scenes/BootScene';
import { ClassroomHUD } from './scenes/ClassroomHUD';
import { ClassroomScene } from './scenes/ClassroomScene';
import { ResultsScene } from './scenes/ResultsScene';
import { SelectScene } from './scenes/SelectScene';

/**
 * Una sesión = una instancia de Phaser.Game. Al destruirla se va todo:
 * texturas, escenas, tweens, temporizadores y listeners (GAME-012).
 */
export class SilentClassSession implements GameSession {
  private game: Phaser.Game | null = null;
  private readonly runtime: SilentClassRuntime;

  constructor(
    private readonly context: GameContext,
    mission: ClassroomMission | null = null,
  ) {
    this.runtime = new SilentClassRuntime(context, mission);
  }

  start(): void {
    const rt = this.runtime;
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.context.container,
      width: GAME_CONFIG.view.width,
      height: GAME_CONFIG.view.height,
      backgroundColor: '#2b2340',
      banner: false,
      disableContextMenu: true,
      audio: { noAudio: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, roundPixels: false },
      // Solo un puntero: los segundos dedos no existen para el juego.
      input: { activePointers: 1 },
      scene: [new BootScene(rt), new SelectScene(rt), new ClassroomScene(rt), new ClassroomHUD(), new ResultsScene(rt)],
    });
  }

  pause(): void {
    // Primero se suelta el control (sin pedo), luego se congela el juego.
    this.runtime.notifyPause();
    this.game?.pause();
  }

  resume(): void {
    this.game?.resume();
  }

  destroy(): void {
    this.runtime.notifyPause();
    if (this.game) {
      this.game.resume();
      this.game.destroy(true);
      this.game = null;
    }
    this.runtime.dispose();
  }
}
