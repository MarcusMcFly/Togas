import Phaser from 'phaser';
import { SKINS } from '../../../core/characters/CharacterRegistry';
import { generateTextures } from '../art/textures';
import { GAME_CONFIG } from '../config/game.config';
import type { SilentClassRuntime } from '../runtime';

/**
 * Genera el arte común y pasa a la pantalla previa a la clase. En una misión no hay
 * pantalla previa: se entra directamente en clase.
 */
export class BootScene extends Phaser.Scene {
  constructor(private readonly rt: SilentClassRuntime) {
    super('boot');
  }

  create(): void {
    const mission = this.rt.mission;
    generateTextures(this, SKINS, GAME_CONFIG.playerSeat, { aristocrat: mission?.rules.aristocrat ?? false });
    if (mission) this.scene.start('classroom', { mode: 'play' });
    else this.scene.start('select');
  }
}
