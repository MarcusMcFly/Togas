import Phaser from 'phaser';
import { STUDENT_CANVAS } from '../art/student';
import { RES, studentTex } from '../art/textures';
import type { ReactionAnim } from '../config/reactions.config';
import type { StudentSeat } from '../config/students.config';
import type { StudentState } from '../systems/StudentReactionSystem';
import { COLORS, DEPTH, addText } from '../ui/theme';

const DREAMS = ['💤', 'z', '♪', '∑', '🍕', 'π'];

/** Variantes de cada reacción, para que no se repitan siempre igual. */
const REACTION_MARKS: Record<ReactionAnim, readonly string[]> = {
  confused: ['?', '??', '🤔'],
  grimace: ['🤢', '😖', '😷'],
  gasHit: ['😵', '🥴', '😣'],
  recoil: ['😫', '💥', '😱'],
  deepSleep: ['💤💤', 'ZZZ', '😴'],
  startled: ['!', '!?', '😳', '😂'],
};

/** Un compañero en pantalla. Su estado lo decide StudentReactionSystem. */
export class Student {
  readonly sprite: Phaser.GameObjects.Image;
  private readonly zzz: Phaser.GameObjects.Text;
  private readonly mark: Phaser.GameObjects.Text;
  private state: StudentState = 'awake';
  private nextFidget: number;
  private writing = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly seat: StudentSeat,
    rowIndex: number,
  ) {
    const S = STUDENT_CANVAS;
    this.sprite = scene.add.image(seat.x, seat.y, studentTex(seat.id, 'awake'))
      .setOrigin(S.seatX / S.width, S.seatY / S.height)
      .setScale(1 / RES.people)
      .setDepth(DEPTH.deskRow + rowIndex * 10 + 1);
    const size = Math.round(22 * seat.scale);
    this.zzz = addText(scene, this.headX + 18 * seat.scale, this.headY - 10, '', size, { color: '#b9a7ff' }).setDepth(DEPTH.bubble - 1).setAlpha(0);
    this.mark = addText(scene, this.headX, this.headY - 34 * seat.scale, '!', Math.round(34 * seat.scale), { color: COLORS.yellowCss })
      .setDepth(DEPTH.bubble - 1).setAlpha(0);
    this.nextFidget = Math.random() * 3000;
  }

  get headX(): number {
    return this.seat.x;
  }

  get headY(): number {
    return this.seat.y - 100 * this.seat.scale;
  }

  setState(state: StudentState, reducedMotion: boolean): void {
    if (state === this.state) return;
    const previous = this.state;
    this.state = state;
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.sprite);
    this.sprite.setAngle(0).setPosition(this.seat.x, this.seat.y);

    const pose = state === 'awake' ? 'awake' : state;
    this.sprite.setTexture(studentTex(this.seat.id, pose));

    tweens.killTweensOf(this.zzz);
    this.zzz.setAlpha(0);
    if (state === 'asleep') this.loopZzz();

    if (state === 'drowsy') {
      tweens.add({ targets: this.sprite, angle: { from: -3, to: 3 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.zzz.setText('z').setAlpha(0.8);
    }

    if (state === 'startled') {
      if (!reducedMotion) tweens.add({ targets: this.sprite, y: this.seat.y - 14 * this.seat.scale, duration: 120, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
      this.flashMark('!');
    }

    // Caer dormido tiene su momento: cabezazo lento.
    if (state === 'asleep' && previous !== 'startled' && !reducedMotion) {
      this.sprite.setScale(1 / RES.people, 1.06 / RES.people);
      tweens.add({ targets: this.sprite, scaleY: 1 / RES.people, duration: 600, ease: 'Bounce.easeOut' });
    }
  }

  /**
   * Reacción cómica a una emisión (IMP-04). Va encima del estado (dormido, adormilado…)
   * y su fuerza escala con `intensity` (0–1). Con movimiento reducido, solo el icono.
   */
  react(anim: ReactionAnim, intensity: number, reducedMotion: boolean): void {
    const marks = REACTION_MARKS[anim];
    this.flashMark(marks[Math.floor(Math.random() * marks.length)], 0.8 + intensity * 0.6);
    if (reducedMotion) return;
    const tweens = this.scene.tweens;
    const s = this.seat.scale;
    const sprite = this.sprite;
    const home = { x: this.seat.x, y: this.seat.y };
    const reset = () => sprite.setPosition(home.x, home.y);
    switch (anim) {
      case 'confused':
        tweens.add({ targets: sprite, angle: Math.random() < 0.5 ? -5 : 5, duration: 260, yoyo: true, hold: 300, ease: 'Sine.easeInOut' });
        break;
      case 'grimace':
        tweens.add({ targets: sprite, x: home.x + 2.5 * s, duration: 60, yoyo: true, repeat: 3 + Math.round(intensity * 3), onComplete: reset });
        break;
      case 'gasHit':
        tweens.add({ targets: sprite, x: home.x + 4 * s, angle: -4, duration: 50, yoyo: true, repeat: 5, onComplete: reset });
        break;
      case 'recoil':
        tweens.add({
          targets: sprite, y: home.y - (10 + intensity * 14) * s, angle: Math.random() < 0.5 ? -8 : 8,
          duration: 140, yoyo: true, hold: 120, ease: 'Quad.easeOut', onComplete: reset,
        });
        break;
      case 'deepSleep':
        sprite.setScale(1 / RES.people, 1.14 / RES.people);
        tweens.add({ targets: sprite, scaleY: 1 / RES.people, duration: 900, ease: 'Bounce.easeOut' });
        break;
      case 'startled':
        // El bote ya lo hace el estado `startled`.
        break;
    }
  }

  /** Ronquido sonoro (evento aleatorio): Zzz grande que llama la atención del profe. */
  snore(): void {
    if (this.state !== 'asleep') return;
    const big = addText(this.scene, this.headX + 10, this.headY - 20, 'ZZZZ…', Math.round(30 * this.seat.scale), { color: '#b9a7ff' })
      .setDepth(DEPTH.bubble);
    this.scene.tweens.add({ targets: big, y: big.y - 40, scale: 1.4, alpha: 0, duration: 1400, ease: 'Sine.easeOut', onComplete: () => big.destroy() });
  }

  update(time: number): void {
    if (this.state !== 'awake' || time < this.nextFidget) return;
    // Los despiertos toman apuntes de vez en cuando.
    this.writing = !this.writing;
    this.sprite.setTexture(studentTex(this.seat.id, this.writing ? 'write' : 'awake'));
    this.nextFidget = time + 1200 + Math.random() * 3500;
  }

  private loopZzz(): void {
    const start = { x: this.headX + 14 * this.seat.scale, y: this.headY - 6 };
    const cycle = () => {
      if (this.state !== 'asleep') return;
      this.zzz.setText(Math.random() < 0.25 ? DREAMS[Math.floor(Math.random() * DREAMS.length)] : 'z Z')
        .setPosition(start.x, start.y).setAlpha(0).setScale(0.6);
      this.scene.tweens.add({
        targets: this.zzz, y: start.y - 26 * this.seat.scale, x: start.x + 10, alpha: { from: 1, to: 0 }, scale: 1.1,
        duration: 1600 + Math.random() * 600, ease: 'Sine.easeOut', onComplete: cycle,
      });
    };
    cycle();
  }

  private flashMark(text: string, size = 1): void {
    this.scene.tweens.killTweensOf(this.mark);
    this.mark.setText(text).setAlpha(1).setScale(0.5 * size);
    this.scene.tweens.add({ targets: this.mark, scale: 1.1 * size, duration: 160, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: this.mark, alpha: 0, delay: 900, duration: 300 });
  }
}
