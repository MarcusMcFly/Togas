import Phaser from 'phaser';
import type { SkinDefinition } from '../../../core/characters/SkinDefinition';
import { LEG_PIVOT, PART_CANVAS, type ButtPose, type TorsoPose } from '../art/seatedPlayer';
import { RES, TEX, buttTex, legTex, torsoTex } from '../art/textures';
import { DEPTH } from '../ui/theme';

const SCALE = 1.08;
const PX = SCALE; // 1 unidad del dibujo = SCALE píxeles lógicos

export interface PlayerFrameInput {
  horizontal: number;
  vertical: number;
  pressureRatio: number;
  holding: boolean;
  reducedMotion: boolean;
}

/**
 * El protagonista sentado, de espaldas. Las piernas siguen a la burbuja horizontal,
 * los glúteos y el tronco a la vertical, y todo tiembla con la presión.
 */
export class SeatedPlayer {
  readonly container: Phaser.GameObjects.Container;
  private readonly legs: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  private readonly butt: Phaser.GameObjects.Image;
  private readonly torso: Phaser.GameObjects.Image;
  private override: { torso: TorsoPose; butt: ButtPose | null; until: number } | null = null;
  private nextSweat = 0;
  /** Desplazamiento extra animable (botes, caídas). */
  lift = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly skin: SkinDefinition,
    readonly x: number,
    readonly y: number,
  ) {
    const ox = PART_CANVAS.originX / PART_CANVAS.width;
    const oy = PART_CANVAS.originY / PART_CANVAS.height;
    const scale = SCALE / RES.people;
    const leg = (side: -1 | 1) => scene.add.image(side * LEG_PIVOT.x * PX, LEG_PIVOT.y * PX, legTex(skin.id, side))
      .setOrigin((PART_CANVAS.originX + side * LEG_PIVOT.x) / PART_CANVAS.width, (PART_CANVAS.originY + LEG_PIVOT.y) / PART_CANVAS.height)
      .setScale(scale);
    this.legs = [leg(-1), leg(1)];
    this.butt = scene.add.image(0, 0, buttTex(skin.id, 'relaxed')).setOrigin(ox, oy).setScale(scale);
    this.torso = scene.add.image(0, 0, torsoTex(skin.id, 'sit')).setOrigin(ox, oy).setScale(scale);
    this.container = scene.add.container(x, y, [...this.legs, this.butt, this.torso]).setDepth(DEPTH.player);
  }

  /** Punto de salida de la nube. */
  get rear(): { x: number; y: number } {
    return { x: this.container.x, y: this.y - 14 * PX };
  }

  get head(): { x: number; y: number } {
    return { x: this.container.x, y: this.y - 128 * PX };
  }

  /** Pose temporal (celebrar, vergüenza, trompetazo…). */
  showPose(torso: TorsoPose, butt: ButtPose | null, ms: number): void {
    this.override = { torso, butt, until: this.scene.time.now + ms };
  }

  /** Bote en la silla del trompetazo (o caída al suelo en los extremos). */
  launch(height: number, fall: boolean, reducedMotion: boolean): void {
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this);
    tweens.killTweensOf(this.container);
    this.lift = 0;
    this.container.setAngle(0);
    if (reducedMotion) height *= 0.3;
    tweens.add({ targets: this, lift: -height, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
    if (fall && !reducedMotion) {
      tweens.add({
        targets: this.container, angle: 78, x: this.x + 46, delay: 300, duration: 380, ease: 'Bounce.easeOut', hold: 900, yoyo: true,
        onComplete: () => this.container.setX(this.x),
      });
    }
  }

  update(input: PlayerFrameInput, time: number): void {
    const { horizontal: h, vertical: v, pressureRatio: p, holding } = input;
    const now = this.scene.time.now;
    if (this.override && now > this.override.until) this.override = null;
    const torsoPose: TorsoPose = this.override?.torso ?? (holding ? 'clench' : 'sit');
    const buttPose: ButtPose = this.override?.butt ?? (holding ? 'clench' : 'relaxed');
    this.torso.setTexture(torsoTex(this.skin.id, torsoPose));
    this.butt.setTexture(buttTex(this.skin.id, buttPose));

    // Temblor por presión (más suave con "reducir movimiento").
    const shake = Math.max(0, p - 0.35) * (input.reducedMotion ? 1 : 3.2);
    const jx = shake ? Math.sin(time * 0.09) * shake : 0;
    const jy = shake ? Math.cos(time * 0.13) * shake * 0.5 : 0;

    // Piernas: se inclinan con la burbuja horizontal.
    for (const leg of this.legs) leg.setAngle(-h * 16 + jx * 0.8);
    // Glúteos y tronco: suben y bajan con la vertical.
    this.butt.setY(-v * 5 * PX);
    this.butt.setScale(SCALE / RES.people * (1 - v * 0.04), SCALE / RES.people * (1 + v * 0.06));
    this.torso.setPosition(jx, -v * 9 * PX + jy);
    this.torso.setAngle(h * 7);
    if (!this.scene.tweens.isTweening(this.container)) this.container.setAngle(h * 2.5);
    this.container.y = this.y + this.lift;

    if (p > 0.6 && time > this.nextSweat) {
      this.nextSweat = time + 900 - p * 500;
      this.sweat();
    }
  }

  private sweat(): void {
    const side = Math.random() < 0.5 ? -1 : 1;
    const head = this.head;
    const drop = this.scene.add.image(head.x + side * 20, head.y - 6, TEX.drop).setScale(1.4 / RES.fx).setDepth(DEPTH.fx);
    this.scene.tweens.add({
      targets: drop, x: drop.x + side * 18, y: drop.y + 30, alpha: 0, duration: 700, ease: 'Quad.easeIn', onComplete: () => drop.destroy(),
    });
  }
}
