import type Phaser from 'phaser';
import { CHARACTER_CANVAS } from '../art/character';
import type { SinglePose } from '../art/poses';
import { ART_SCALE, TEX, charTex, idleAnim, runAnim } from '../art/textures';
import { GAME_CONFIG } from '../config/game.config';
import { REFERENCE_HEIGHT_M, type SkinDefinition } from '../config/skins.config';
import type { RunnerSystem } from '../systems/RunnerSystem';
import { DEPTH } from '../ui/theme';

/** Prioridad de las posturas especiales: una de mayor prioridad no se interrumpe por otra menor. */
const PRIORITY: Record<SinglePose, number> = {
  land: 1, collect: 2, hit: 3, burp: 4, fart: 4, strong: 5, jump: 0, fall: 0,
};

/**
 * Representación visual del jugador. La física vive en RunnerSystem; esta clase
 * solo decide qué fotograma mostrar y dónde.
 */
export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  /** Escala visual: refleja la altura de la skin (Marcus es un 4,4 % más bajo), no su colisión. */
  private readonly visualScale: number;
  private special: SinglePose | null = null;
  private specialUntil = 0;
  /** Retroceso visual (no afecta a la física). */
  offsetX = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly skin: SkinDefinition,
    private readonly x: number,
  ) {
    this.visualScale = skin.heightM / REFERENCE_HEIGHT_M / ART_SCALE;
    this.shadow = scene.add.image(x, GAME_CONFIG.groundY, TEX.shadow).setDepth(DEPTH.shadows).setScale(0.5);
    this.sprite = scene.add
      .sprite(x, GAME_CONFIG.groundY, charTex(skin.id, 'idle0'))
      .setOrigin(CHARACTER_CANVAS.feetX / CHARACTER_CANVAS.width, CHARACTER_CANVAS.feetY / CHARACTER_CANVAS.height)
      .setScale(this.visualScale)
      .setDepth(DEPTH.player);
  }

  /** Punto de la boca (de donde salen los eructos). */
  get mouth(): { x: number; y: number } {
    const s = this.visualScale * ART_SCALE;
    return { x: this.sprite.x + 18 * s, y: this.sprite.y - 96 * s };
  }

  /** Punto trasero (de donde salen los pedos). */
  get rear(): { x: number; y: number } {
    const s = this.visualScale * ART_SCALE;
    return { x: this.sprite.x - 22 * s, y: this.sprite.y - 46 * s };
  }

  idle(): void {
    this.special = null;
    this.sprite.play(idleAnim(this.skin.id), true);
  }

  showPose(pose: SinglePose, durationMs: number): void {
    const now = this.scene.time.now;
    if (this.special && now < this.specialUntil && PRIORITY[this.special] > PRIORITY[pose]) return;
    this.special = pose;
    this.specialUntil = now + durationMs;
  }

  flash(color: number, durationMs: number): void {
    this.sprite.setTint(color);
    this.scene.time.delayedCall(durationMs, () => this.sprite.clearTint());
  }

  update(runner: RunnerSystem): void {
    const groundY = GAME_CONFIG.groundY;
    this.sprite.x = this.x + this.offsetX;
    this.sprite.y = groundY - runner.height;

    // La sombra se encoge y aclara al subir.
    const lift = Math.min(runner.height / 200, 1);
    this.shadow.x = this.sprite.x;
    this.shadow.setScale(0.5 * (1 - lift * 0.5), 0.5 * (1 - lift * 0.3));
    this.shadow.setAlpha(1 - lift * 0.6);

    if (this.special && this.scene.time.now >= this.specialUntil) this.special = null;
    const pose = this.special ?? (runner.grounded ? null : runner.velocityY > 0 ? 'jump' : 'fall');
    if (pose) {
      this.sprite.anims.stop();
      this.sprite.setTexture(charTex(this.skin.id, pose));
    } else {
      this.sprite.play(runAnim(this.skin.id), true);
      // Las piernas van más rápido cuanto más rápido corre.
      this.sprite.anims.timeScale = runner.speed / GAME_CONFIG.runner.startSpeed;
    }
  }
}
