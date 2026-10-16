import Phaser from 'phaser';
import { createAnimations, generateTextures } from '../art/textures';
import { SKINS } from '../../../core/characters/CharacterRegistry';

/** Genera todo el arte (texturas y animaciones) y pasa a la selección de personaje. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    generateTextures(this, SKINS);
    createAnimations(this, SKINS);
    this.scene.start('select');
  }
}
