import { ART_SCALE } from '../art/textures';
import { COLLECTIBLE_HITBOX, type CollectibleDefinition } from '../config/collectibles.config';
import { GAME_CONFIG } from '../config/game.config';
import { WorldObject } from './WorldObject';

/** Comida o bebida. Las que flotan se balancean un poco para llamar la atención. */
export class Collectible extends WorldObject<CollectibleDefinition> {
  private phase = 0;

  protected onActivate(): void {
    this.phase = Math.random() * Math.PI * 2;
    this.shadow.setScale(0.32, 0.4);
  }

  protected layout(_screenX: number, time: number): void {
    const airborne = this.height > COLLECTIBLE_HITBOX.height;
    const bob = airborne ? Math.sin(time * 4 + this.phase) * 4 : 0;
    this.sprite.y = GAME_CONFIG.groundY - this.height + bob;
    if (!this.consumed) this.sprite.setAngle(Math.sin(time * 3 + this.phase) * 6);
    this.shadow.setAlpha(airborne ? 0.35 : 1);
  }

  /** Animación de "ñam": crece y se desvanece. */
  pickup(): void {
    this.consumed = true;
    this.shadow.setVisible(false);
    this.scene.tweens.add({
      targets: this.sprite,
      scale: (1 / ART_SCALE) * 1.7,
      alpha: 0,
      angle: 20,
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () => this.deactivate(),
    });
  }
}
