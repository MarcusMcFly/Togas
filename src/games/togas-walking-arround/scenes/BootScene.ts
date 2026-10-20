import Phaser from 'phaser';
import { createAnimations, generateTextures } from '../art/textures';
import { SKINS } from '../../../core/characters/CharacterRegistry';
import type { TogasRuntime } from '../runtime';

/**
 * Genera todo el arte (texturas y animaciones) y pasa a la selección de personaje.
 * En una misión el personaje ya viene dado: se va directo a la partida.
 */
export class BootScene extends Phaser.Scene {
  constructor(private readonly rt: TogasRuntime) {
    super('boot');
  }

  create(): void {
    generateTextures(this, SKINS, { night: this.rt.ruleset.night });
    createAnimations(this, SKINS);
    this.scene.start(this.rt.mission ? 'play' : 'select');
  }
}
