import { TRAVERSAL_CANVAS } from '../art/landmarks';
import { barrierTex } from '../art/textures';
import type { TraversalObstacleDefinition } from '../config/traversal.config';
import { GAME_CONFIG } from '../config/game.config';
import { WorldObject } from './WorldObject';

/** Obstáculo de recorrido: valla o jardinera (saltar), andamio o cartel (rodar). */
export class Barrier extends WorldObject<TraversalObstacleDefinition> {
  protected textureFor(def: TraversalObstacleDefinition): string {
    return barrierTex(def.id);
  }

  protected onActivate(): void {
    const canvas = TRAVERSAL_CANVAS[this.def.id];
    this.sprite.setOrigin(0.5, canvas.groundY / canvas.height);
    this.shadow.setScale(canvas.width / 90, 0.45).setAlpha(0.8);
  }

  protected layout(): void {
    this.sprite.y = GAME_CONFIG.groundY;
  }

  /** Golpe: el obstáculo se tambalea y se queda donde está. */
  bump(): void {
    this.consumed = true;
    this.scene.tweens.add({ targets: this.sprite, angle: { from: -6, to: 6 }, duration: 70, yoyo: true, repeat: 2, onComplete: () => this.sprite.setAngle(0) });
    this.sprite.setTint(0xffb3c1);
    this.scene.time.delayedCall(260, () => this.sprite.clearTint());
  }
}
