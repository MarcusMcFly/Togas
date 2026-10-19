import Phaser from 'phaser';
import { PROFESSOR_CANVAS, type ProfessorFrame } from '../art/professor';
import { RES, professorTex } from '../art/textures';
import type { ProfessorStateId } from '../config/professor.config';
import { COLORS, DEPTH, addText } from '../ui/theme';

const HOME = { x: 470, y: 264, scale: 0.86 } as const;
const ICON_Y = HOME.y - 175;

/** Lo que pasa en un fotograma que la escena quiera sonorizar. */
export interface ProfessorTick {
  /** Ha dado un trazo de tiza (cada medio ciclo de escritura). */
  chalkStroke: boolean;
}

/**
 * El profesor en pantalla: elige el fotograma según el estado de ProfessorAI,
 * muestra el icono de atención y los bocadillos. No decide nada.
 */
export class Professor {
  readonly sprite: Phaser.GameObjects.Image;
  private readonly icon: Phaser.GameObjects.Text;
  private readonly bubble: Phaser.GameObjects.Container;
  private readonly bubbleBg: Phaser.GameObjects.Graphics;
  private readonly bubbleText: Phaser.GameObjects.Text;
  private bubbleTimer: Phaser.Time.TimerEvent | null = null;
  private lastStroke = -1;
  private state: ProfessorStateId = 'writing';
  /** Derrotado (campaña): ya no cambia de fotograma ni de estado. */
  private defeated = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.sprite = scene.add.image(HOME.x, HOME.y, professorTex('write0'))
      .setOrigin(PROFESSOR_CANVAS.feetX / PROFESSOR_CANVAS.width, PROFESSOR_CANVAS.feetY / PROFESSOR_CANVAS.height)
      .setScale(HOME.scale / RES.people)
      .setDepth(DEPTH.professor);
    this.icon = addText(scene, HOME.x, ICON_Y, '', 34, { color: COLORS.yellowCss }).setDepth(DEPTH.bubble).setAlpha(0);

    this.bubbleBg = scene.add.graphics();
    this.bubbleText = scene.add.text(0, 0, '', {
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
      fontSize: '16px', fontStyle: '800', color: COLORS.inkCss, align: 'center', resolution: 2,
      wordWrap: { width: 210 },
    }).setOrigin(0.5);
    this.bubble = scene.add.container(HOME.x + 128, HOME.y - 170, [this.bubbleBg, this.bubbleText]).setDepth(DEPTH.bubble).setAlpha(0);
  }

  get headX(): number {
    return this.sprite.x;
  }

  get headY(): number {
    return this.sprite.y - 150 * HOME.scale;
  }

  setState(state: ProfessorStateId, targetX: number | null): void {
    if (this.defeated) return;
    this.state = state;
    this.scene.tweens.killTweensOf(this.icon);
    const icon = state === 'warning' ? '!' : state === 'watching' ? '?' : state === 'investigating' ? '!!' : '';
    this.icon.setText(icon).setColor(state === 'investigating' ? '#ff4d6d' : COLORS.yellowCss);
    if (icon) {
      this.icon.setAlpha(1).setScale(0.4).setY(ICON_Y);
      this.scene.tweens.add({ targets: this.icon, scale: 1, duration: 260, ease: 'Back.easeOut' });
      this.scene.tweens.add({ targets: this.icon, y: ICON_Y - 6, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      this.icon.setAlpha(0);
    }
    // Al investigar se acerca un poco hacia el sospechoso.
    const x = state === 'investigating' && targetX !== null ? Phaser.Math.Clamp(HOME.x + (targetX - HOME.x) * 0.25, 380, 580) : HOME.x;
    this.scene.tweens.add({ targets: [this.sprite], x, duration: 400, ease: 'Sine.easeInOut' });
    this.sprite.setFlipX(state === 'investigating' && targetX !== null && targetX < HOME.x);
  }

  update(time: number): ProfessorTick {
    if (this.defeated) return { chalkStroke: false };
    const frame = this.frameFor(time);
    this.sprite.setTexture(professorTex(frame));
    this.icon.x = this.sprite.x;
    this.bubble.x = Phaser.Math.Clamp(this.sprite.x + 128, 200, 760);
    const stroke = this.state === 'writing' ? Math.floor(time / 260) : -1;
    const chalkStroke = stroke !== this.lastStroke && stroke >= 0;
    this.lastStroke = stroke;
    return { chalkStroke };
  }

  say(text: string, durationMs: number, style: 'lecture' | 'shout' = 'lecture'): void {
    this.bubbleTimer?.remove();
    const shout = style === 'shout';
    this.bubbleText.setText(text).setFontSize(shout ? 19 : 15).setColor(shout ? '#c1121f' : COLORS.inkCss);
    const w = Math.max(90, this.bubbleText.width + 28);
    const h = this.bubbleText.height + 20;
    const g = this.bubbleBg;
    g.clear();
    g.fillStyle(COLORS.ink, 1).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 14);
    g.fillStyle(shout ? 0xfff0f0 : COLORS.paper, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.lineStyle(3, shout ? 0xc1121f : COLORS.ink, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.fillStyle(shout ? 0xfff0f0 : COLORS.paper, 1).fillTriangle(-w / 2 + 16, h / 2 - 2, -w / 2 + 34, h / 2 - 2, -w / 2 + 6, h / 2 + 16);
    g.lineStyle(3, shout ? 0xc1121f : COLORS.ink, 1).lineBetween(-w / 2 + 16, h / 2, -w / 2 + 6, h / 2 + 16).lineBetween(-w / 2 + 6, h / 2 + 16, -w / 2 + 34, h / 2);
    this.scene.tweens.killTweensOf(this.bubble);
    this.bubble.setAlpha(1).setScale(shout ? 0.6 : 0.85);
    this.scene.tweens.add({ targets: this.bubble, scale: 1, duration: shout ? 280 : 180, ease: 'Back.easeOut' });
    this.bubbleTimer = this.scene.time.delayedCall(durationMs, () => {
      this.scene.tweens.add({ targets: this.bubble, alpha: 0, duration: 250 });
    });
  }

  hideBubble(): void {
    this.bubbleTimer?.remove();
    this.bubble.setAlpha(0);
  }

  /** Se le cae la tiza del susto. */
  flinch(): void {
    this.scene.tweens.add({ targets: this.sprite, y: HOME.y - 10, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** La nube final le alcanza: se tambalea y se desploma sobre la mesa (dibujos animados). */
  collapse(reducedMotion: boolean): void {
    this.defeated = true;
    this.hideBubble();
    this.scene.tweens.killTweensOf([this.sprite, this.icon]);
    this.sprite.setTexture(professorTex('angry')).setFlipX(false);
    this.icon.setText('😵').setColor('#ffffff').setAlpha(1).setScale(1).setY(ICON_Y);
    const tweens = this.scene.tweens;
    if (reducedMotion) {
      tweens.add({ targets: this.sprite, angle: 70, y: HOME.y + 40, duration: 600, ease: 'Quad.easeIn' });
      return;
    }
    tweens.add({
      targets: this.sprite, angle: { from: -8, to: 8 }, duration: 120, yoyo: true, repeat: 3,
      onComplete: () => {
        tweens.add({ targets: this.sprite, angle: 78, y: HOME.y + 46, x: this.sprite.x + 20, duration: 520, ease: 'Bounce.easeOut' });
        tweens.add({ targets: this.icon, y: ICON_Y + 90, x: this.sprite.x + 70, duration: 520, ease: 'Bounce.easeOut' });
      },
    });
  }

  private frameFor(time: number): ProfessorFrame {
    switch (this.state) {
      case 'writing':
        return Math.floor(time / 260) % 2 === 0 ? 'write0' : 'write1';
      case 'reading':
        return 'reading';
      case 'chalkDrop':
        return 'bend';
      case 'erasing':
        return Math.floor(time / 150) % 2 === 0 ? 'erase0' : 'erase1';
      case 'warning':
        return 'backLook';
      case 'turning':
      case 'turningBack':
        return 'side';
      case 'explaining':
        return Math.floor(time / 190) % 3 === 0 ? 'front' : 'talk';
      case 'watching':
        return 'watch';
      case 'investigating':
        return 'angry';
    }
  }
}
