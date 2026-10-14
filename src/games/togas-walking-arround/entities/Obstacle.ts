import Phaser from 'phaser';
import { OBSTACLE_CANVAS } from '../art/items';
import { ART_SCALE, TEX } from '../art/textures';
import type { ObstacleDefinition } from '../config/collectibles.config';
import { GAME_CONFIG } from '../config/game.config';
import { DEPTH } from '../ui/theme';
import { WorldObject } from './WorldObject';

/** Antigás apoyado en el suelo, con un halo rojizo que avisa de que hay que esquivarlo. */
export class Obstacle extends WorldObject<ObstacleDefinition> {
  private readonly aura: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.aura = scene.add.image(0, 0, TEX.glow).setTint(0xff4d6d).setDepth(DEPTH.items - 0.5).setVisible(false);
    this.sprite.setOrigin(0.5, 58 / OBSTACLE_CANVAS.height);
  }

  protected onActivate(): void {
    this.shadow.setScale(0.36, 0.45);
    this.aura.setVisible(true).setAlpha(0.5);
  }

  protected onDeactivate(): void {
    this.aura.setVisible(false);
  }

  protected layout(screenX: number, time: number): void {
    this.sprite.y = GAME_CONFIG.groundY;
    this.aura.setPosition(screenX, GAME_CONFIG.groundY - 22);
    if (!this.consumed) {
      const pulse = 0.5 + Math.sin(time * 5) * 0.15;
      this.aura.setAlpha(pulse).setScale(0.75 + pulse * 0.2);
    }
  }

  /** Efecto de "desinflado" al tocarlo. */
  deflate(): void {
    this.consumed = true;
    this.aura.setVisible(false);
    const base = 1 / ART_SCALE;
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: base * 1.35,
      scaleY: base * 0.25,
      alpha: 0,
      duration: 320,
      ease: 'Quad.easeIn',
      onComplete: () => this.deactivate(),
    });
  }
}
