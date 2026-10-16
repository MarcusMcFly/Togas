import Phaser from 'phaser';
import { SKINS } from '../../../core/characters/CharacterRegistry';
import { generateTextures } from '../art/textures';
import { GAME_CONFIG } from '../config/game.config';

/** Genera el arte común y pasa a la pantalla previa a la clase. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    generateTextures(this, SKINS, GAME_CONFIG.playerSeat);
    this.scene.start('select');
  }
}
