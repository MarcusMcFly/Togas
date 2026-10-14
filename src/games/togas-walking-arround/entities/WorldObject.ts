import type Phaser from 'phaser';
import { ART_SCALE, TEX, itemTex } from '../art/textures';
import { GAME_CONFIG } from '../config/game.config';
import { DEPTH } from '../ui/theme';

/**
 * Base de todo lo que aparece en el recorrido (comida y antigases).
 * Se reutilizan desde un pool: `activate()` lo saca, `deactivate()` lo devuelve.
 */
export abstract class WorldObject<Def extends { id: string }> {
  readonly sprite: Phaser.GameObjects.Image;
  protected readonly shadow: Phaser.GameObjects.Image;
  def!: Def;
  /** X del centro en coordenadas de mundo. */
  worldX = 0;
  /** Altura sobre el suelo (ver SpawnRequest). */
  height = 0;
  active = false;
  /** Ya se ha tocado: no vuelve a colisionar, pero puede seguir animándose. */
  consumed = false;

  constructor(protected readonly scene: Phaser.Scene) {
    this.shadow = scene.add.image(0, GAME_CONFIG.groundY, TEX.shadow).setDepth(DEPTH.shadows).setVisible(false);
    this.sprite = scene.add.image(0, 0, TEX.shadow).setDepth(DEPTH.items).setVisible(false);
  }

  activate(def: Def, worldX: number, height: number): void {
    this.def = def;
    this.worldX = worldX;
    this.height = height;
    this.active = true;
    this.consumed = false;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setTexture(itemTex(def.id)).setVisible(true).setAlpha(1).setScale(1 / ART_SCALE).setAngle(0);
    this.shadow.setVisible(true).setAlpha(1);
    this.onActivate();
  }

  deactivate(): void {
    this.active = false;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setVisible(false);
    this.shadow.setVisible(false);
    this.onDeactivate();
  }

  /** Coloca el objeto en pantalla según la distancia recorrida. */
  place(screenX: number, time: number): void {
    this.sprite.x = screenX;
    this.shadow.x = screenX;
    this.layout(screenX, time);
  }

  protected abstract layout(screenX: number, time: number): void;
  protected onActivate(): void {}
  protected onDeactivate(): void {}
}
