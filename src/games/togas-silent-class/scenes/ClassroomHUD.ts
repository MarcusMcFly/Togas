import Phaser from 'phaser';
import { drawPanel } from '../../../core/ui/phaser/widgets';
import { RES, faceTex } from '../art/textures';
import { GAME_CONFIG } from '../config/game.config';
import { AttentionIndicator } from '../ui/AttentionIndicator';
import { PressureMeter } from '../ui/PressureMeter';
import { SpiritLevelHUD } from '../ui/SpiritLevelHUD';
import { COLORS, LEVEL_COLORS, addText } from '../ui/theme';
import type { ClassroomView } from '../ui/view';

/** Disposición del HUD (spec 14.2). Los niveles van abajo, en el centro. */
const LAYOUT = {
  horizontal: { x: 480, y: 518, length: 290, thickness: 30 },
  vertical: { x: 618, y: 420, length: 140, thickness: 30 },
  pressure: { x: 342, y: 416, width: 26, height: 116 },
  balanceTag: { x: 480, y: 489 },
  /** Tarjeta del tutorial: en la pared izquierda, lejos de la cara del profe y de los niveles. */
  tutorial: { x: 12, y: 96, width: 214, padding: 11 },
} as const;

/** Contenido de la tarjeta del tutorial. */
export interface TutorialCard {
  /** Etiqueta pequeña de arriba, p. ej. "PASO 1 DE 4". */
  step: string;
  title: string;
  body: string;
}

/**
 * HUD en una escena aparte, encima del aula: las sacudidas de cámara nunca
 * mueven los niveles. Solo lee `ClassroomView`; no toca la lógica.
 */
export class ClassroomHUD extends Phaser.Scene {
  private view!: ClassroomView;
  private portrait!: Phaser.GameObjects.Image;
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private asleepText!: Phaser.GameObjects.Text;
  private strikes!: Phaser.GameObjects.Graphics;
  private levelH!: SpiritLevelHUD;
  private levelV!: SpiritLevelHUD;
  private pressure!: PressureMeter;
  private attention!: AttentionIndicator;
  private balanceTag!: Phaser.GameObjects.Container;
  private balanceTagBar!: Phaser.GameObjects.Graphics;
  private balanceTagText!: Phaser.GameObjects.Text;
  private joystick!: Phaser.GameObjects.Graphics;
  private vignette!: Phaser.GameObjects.Graphics;
  private tutorialBox!: Phaser.GameObjects.Container;
  private tutorialBg!: Phaser.GameObjects.Graphics;
  private tutorialStep!: Phaser.GameObjects.Text;
  private tutorialTitle!: Phaser.GameObjects.Text;
  private tutorialBody!: Phaser.GameObjects.Text;
  private tutorialFeedback!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private lastScore = -1;
  private lastSeconds = -1;
  private lastAsleep = -1;
  private lastStrikes = -1;
  private lastStreak = -1;
  private lastExpression = '';
  private vignetteAlpha = 0;

  constructor() {
    super('hud');
  }

  create(data: { view: ClassroomView }): void {
    this.view = data.view;
    this.lastScore = this.lastSeconds = this.lastAsleep = this.lastStrikes = this.lastStreak = -1;
    this.lastExpression = '';
    const { width } = GAME_CONFIG.view;

    this.vignette = this.add.graphics();
    this.joystick = this.add.graphics();

    // Arriba a la izquierda: retrato, puntos, tiempo y racha.
    const avatar = this.add.graphics();
    avatar.fillStyle(COLORS.ink, 1).fillCircle(42, 46, 33);
    avatar.fillStyle(COLORS.paper, 1).fillCircle(42, 42, 32);
    avatar.lineStyle(3, COLORS.ink, 1).strokeCircle(42, 42, 32);
    this.portrait = this.add.image(42, 42, faceTex(this.view.skinId, 'calm')).setScale(0.85 / RES.fx);
    addText(this, 84, 20, 'PUNTOS', 13, { align: 'left', stroke: 4 });
    this.scoreText = addText(this, 84, 44, '0', 28, { align: 'left', color: COLORS.yellowCss });
    this.timerText = addText(this, 84, 74, '', 18, { align: 'left', stroke: 4 });
    this.comboText = addText(this, 160, 74, '', 16, { align: 'left', color: '#b5e36b', stroke: 4 });

    // Centro: ¿adónde mira el profe?
    this.attention = new AttentionIndicator(this, width / 2, 32);

    // Derecha: dormidos y avisos.
    this.asleepText = addText(this, width - 18, 22, '', 18, { align: 'right', color: '#b9a7ff', stroke: 4 });
    addText(this, width - 128, 52, 'AVISOS', 13, { align: 'right', stroke: 4 });
    this.strikes = this.add.graphics();

    // Abajo: niveles de burbuja y gas.
    this.levelH = new SpiritLevelHUD(this, { ...LAYOUT.horizontal, orientation: 'horizontal', label: 'PIERNAS' });
    this.levelV = new SpiritLevelHUD(this, { ...LAYOUT.vertical, orientation: 'vertical', label: 'GLÚTEOS' });
    this.pressure = new PressureMeter(this, LAYOUT.pressure.x, LAYOUT.pressure.y, LAYOUT.pressure.width, LAYOUT.pressure.height);

    this.balanceTagBar = this.add.graphics();
    this.balanceTagText = addText(this, 0, 0, '', 13, { color: COLORS.inkCss, stroke: 0 });
    this.balanceTag = this.add.container(LAYOUT.balanceTag.x, LAYOUT.balanceTag.y, [this.balanceTagBar, this.balanceTagText]).setVisible(false);

    // Mensajes.
    const card = LAYOUT.tutorial;
    const wrapWidth = card.width - card.padding * 2;
    const line = (size: number, color: string, weight = '900') =>
      addText(this, card.padding, 0, '', size, { color, stroke: 0, align: 'left', weight, wrapWidth }).setOrigin(0);
    this.tutorialBg = this.add.graphics();
    this.tutorialStep = line(12, '#7a6a2e');
    this.tutorialTitle = line(18, COLORS.inkCss);
    this.tutorialBody = line(13, '#3b3360', '700');
    this.tutorialFeedback = line(13, '#d62839', '800');
    this.tutorialBox = this.add.container(card.x, card.y, [
      this.tutorialBg, this.tutorialStep, this.tutorialTitle, this.tutorialBody, this.tutorialFeedback,
    ]).setVisible(false);
    this.toastText = addText(this, width / 2, 96, '', 20, { stroke: 5 }).setAlpha(0);
  }

  update(time: number, deltaMs: number): void {
    const v = this.view;
    if (!v) return;

    if (v.score !== this.lastScore) {
      const grew = v.score > this.lastScore && this.lastScore >= 0;
      this.lastScore = v.score;
      this.scoreText.setText(v.score.toLocaleString('es-ES'));
      if (grew) this.tweens.add({ targets: this.scoreText, scale: { from: 1.2, to: 1 }, duration: 200 });
    }
    const seconds = Math.ceil(v.timeLeft);
    if (seconds !== this.lastSeconds) {
      this.lastSeconds = seconds;
      this.timerText.setText(v.mode === 'tutorial' ? 'Práctica' : `⏱ ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
      this.timerText.setColor(v.mode === 'play' && seconds <= 10 ? '#ff4d6d' : '#ffffff');
    }
    if (v.streak !== this.lastStreak) {
      this.lastStreak = v.streak;
      this.comboText.setText(v.streak > 0 ? `Racha ${v.streak} · ×${v.multiplier.toFixed(1)}` : '');
      if (v.streak > 0) this.tweens.add({ targets: this.comboText, scale: { from: 1.3, to: 1 }, duration: 240, ease: 'Back.easeOut' });
    }
    if (v.asleep !== this.lastAsleep) {
      this.lastAsleep = v.asleep;
      this.asleepText.setText(`💤 Dormidos ${v.asleep} / ${v.totalStudents}`);
      this.tweens.add({ targets: this.asleepText, scale: { from: 1.2, to: 1 }, duration: 220 });
    }
    if (v.strikesLeft !== this.lastStrikes) {
      this.lastStrikes = v.strikesLeft;
      this.drawStrikes();
    }
    if (v.expression !== this.lastExpression) {
      this.lastExpression = v.expression;
      this.portrait.setTexture(faceTex(v.skinId, v.expression));
    }

    this.attention.draw(v.attention, v.attentionProgress, v.attentionEmphasis, time);
    this.attention.setNote(v.silence ? '🤫 Silencio inesperado…' : '');

    this.levelH.setVisible(v.showLevels).draw(v.horizontal, v.zoneH, v.holding, v.highContrast, time);
    this.levelV.setVisible(v.showLevels).draw(v.vertical, v.zoneV, v.holding, v.highContrast, time);
    this.pressure.setVisible(v.showLevels).draw(v.pressure, deltaMs, time);
    this.drawBalanceTag();
    this.drawJoystick();
    this.drawVignette(deltaMs);
  }

  // ——— API para ClassroomScene ———

  banner(text: string, color: string, size = 56, holdMs = 700): void {
    const { width, height } = GAME_CONFIG.view;
    const t = addText(this, width / 2, height * 0.42, text, size, { color, wrapWidth: 860 }).setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 30, delay: 220 + holdMs, duration: 320, onComplete: () => t.destroy() });
  }

  toast(text: string, color = '#ffffff', ms = 1600): void {
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setText(text).setColor(color).setAlpha(1).setScale(0.8);
    this.tweens.add({ targets: this.toastText, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: ms, duration: 300 });
  }

  tutorial(card: TutorialCard | null): void {
    this.tutorialBox.setVisible(card !== null);
    if (card === null) return;
    this.tutorialStep.setText(card.step);
    this.tutorialTitle.setText(card.title);
    this.tutorialBody.setText(card.body);
    this.tutorialFeedback.setText('');
    this.layoutTutorial();
    this.tweens.killTweensOf(this.tutorialBox);
    this.tutorialBox.setAlpha(0).setX(LAYOUT.tutorial.x - 16);
    this.tweens.add({ targets: this.tutorialBox, alpha: 1, x: LAYOUT.tutorial.x, duration: 220, ease: 'Back.easeOut' });
  }

  /** Aviso dentro de la tarjeta del tutorial (en vez de un toast sobre el profe). */
  tutorialHint(text: string): void {
    if (!this.tutorialBox.visible) return;
    this.tutorialFeedback.setText(text);
    this.layoutTutorial();
    this.tweens.killTweensOf(this.tutorialFeedback);
    this.tutorialFeedback.setScale(0.9);
    this.tweens.add({ targets: this.tutorialFeedback, scale: 1, duration: 180, ease: 'Back.easeOut' });
  }

  /** Apila los textos de la tarjeta y ajusta el panel a su altura. */
  private layoutTutorial(): void {
    const { width, padding } = LAYOUT.tutorial;
    let y = padding;
    for (const [text, gap] of [[this.tutorialStep, 2], [this.tutorialTitle, 6], [this.tutorialBody, 8], [this.tutorialFeedback, 0]] as const) {
      text.setVisible(text.text !== '');
      if (!text.visible) continue;
      text.setY(y);
      y += text.height + gap;
    }
    const height = Math.ceil(y + padding - (this.tutorialFeedback.visible ? 0 : 8));
    drawPanel(this.tutorialBg, width, height, { radius: 16, fill: 0xfff3c4, shadow: 5 });
    this.tutorialBg.setPosition(width / 2, height / 2);
  }

  /** Latido visual (equivalente del sonido del corazón). */
  heartbeat(): void {
    this.vignetteAlpha = 0.55;
  }

  /** Tic visual del medidor (equivalente del tic sonoro). */
  tick(): void {
    this.pressure.pulse();
  }

  private drawStrikes(): void {
    const v = this.view;
    const g = this.strikes;
    g.clear();
    const used = v.maxStrikes - v.strikesLeft;
    for (let i = 0; i < v.maxStrikes; i++) {
      const x = GAME_CONFIG.view.width - 100 + i * 34;
      const y = 54;
      const filled = i < used;
      g.fillStyle(COLORS.ink, 1).fillTriangle(x, y - 12 + 3, x - 13, y + 11 + 3, x + 13, y + 11 + 3);
      g.fillStyle(filled ? 0xff4d6d : 0x3b3360, 1).fillTriangle(x, y - 12, x - 13, y + 11, x + 13, y + 11);
      g.lineStyle(2.5, filled ? 0xffffff : 0x8f87b5, 1).strokeTriangle(x, y - 12, x - 13, y + 11, x + 13, y + 11);
      if (filled) {
        g.fillStyle(0xffffff, 1).fillRect(x - 1.5, y - 5, 3, 8).fillCircle(x, y + 6, 1.8);
      }
    }
  }

  private drawBalanceTag(): void {
    const v = this.view;
    const recovering = v.blocked === 'recovering';
    const show = v.showLevels && v.holding && (v.stability > 0 || recovering);
    this.balanceTag.setVisible(show);
    if (!show) return;
    // Mismo criterio que la liberación: "listo" solo si soltar sería silencioso.
    const done = v.ready;
    const w = done ? 190 : 120;
    const g = this.balanceTagBar;
    g.clear();
    g.fillStyle(COLORS.ink, 1).fillRoundedRect(-w / 2, -10 + 3, w, 20, 10);
    g.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -10, w, 20, 10);
    const palette = v.highContrast ? LEVEL_COLORS.contrast : LEVEL_COLORS.normal;
    g.fillStyle(done ? palette.ready : palette.settling, 1).fillRoundedRect(-w / 2, -10, Math.max(20, w * v.stability), 20, 10);
    g.lineStyle(2, COLORS.ink, 1).strokeRoundedRect(-w / 2, -10, w, 20, 10);
    this.balanceTagText.setText(done ? '✓ ¡LISTO! SUELTA' : recovering ? 'Recuperando aire…' : 'Equilibrando…');
  }

  private drawJoystick(): void {
    const j = this.view.joystick;
    const g = this.joystick;
    g.clear();
    if (!j.active) return;
    const r = GAME_CONFIG.joystick.radius;
    g.fillStyle(0xffffff, 0.12).fillCircle(j.originX, j.originY, r);
    g.lineStyle(3, 0xffffff, 0.45).strokeCircle(j.originX, j.originY, r);
    // Flechas de dirección: se iluminan hacia donde empujas.
    const dx = (j.thumbX - j.originX) / r;
    const dy = (j.thumbY - j.originY) / r;
    const arrows: Array<[number, number, number]> = [[1, 0, dx], [-1, 0, -dx], [0, 1, dy], [0, -1, -dy]];
    for (const [ax, ay, amount] of arrows) {
      const cx = j.originX + ax * (r - 12);
      const cy = j.originY + ay * (r - 12);
      g.fillStyle(0xffffff, 0.3 + Math.max(0, amount) * 0.7);
      g.fillTriangle(cx + ax * 8, cy + ay * 8, cx - ay * 7 - ax * 2, cy + ax * 7 - ay * 2, cx + ay * 7 - ax * 2, cy - ax * 7 - ay * 2);
    }
    g.lineStyle(4, 0xffffff, 0.35).lineBetween(j.originX, j.originY, j.thumbX, j.thumbY);
    g.fillStyle(COLORS.ink, 0.5).fillCircle(j.thumbX, j.thumbY + 3, 26);
    g.fillStyle(0xffffff, 0.9).fillCircle(j.thumbX, j.thumbY, 26);
    g.lineStyle(3, COLORS.ink, 1).strokeCircle(j.thumbX, j.thumbY, 26);
  }

  private drawVignette(deltaMs: number): void {
    const g = this.vignette;
    g.clear();
    if (this.vignetteAlpha <= 0.01) return;
    const { width, height } = GAME_CONFIG.view;
    for (let i = 0; i < 4; i++) {
      g.lineStyle(14, 0xff2d55, this.vignetteAlpha * (1 - i * 0.25));
      g.strokeRect(i * 12 + 7, i * 12 + 7, width - i * 24 - 14, height - i * 24 - 14);
    }
    this.vignetteAlpha *= Math.pow(0.04, deltaMs / 1000);
  }
}
