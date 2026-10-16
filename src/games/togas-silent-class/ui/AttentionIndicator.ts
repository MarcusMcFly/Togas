import Phaser from 'phaser';
import type { AttentionLevel } from '../config/professor.config';
import { COLORS, addText } from './theme';
import { drawPanel } from '../../../core/ui/phaser/widgets';

const LABELS: Record<AttentionLevel, string> = {
  away: 'De espaldas',
  aboutToTurn: '¡Se va a girar!',
  turning: 'Girándose…',
  facing: 'Mira a la clase',
  watching: '¡OBSERVANDO!',
  investigating: '¡¡TE BUSCA!!',
};

/**
 * ¿Adónde mira el profe? Complementa (no sustituye) su animación: icono de ojo,
 * texto y barra de progreso del aviso/giro.
 */
export class AttentionIndicator {
  private readonly eye: Phaser.GameObjects.Graphics;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly note: Phaser.GameObjects.Text;
  private readonly container: Phaser.GameObjects.Container;
  private level: AttentionLevel | null = null;

  constructor(private readonly scene: Phaser.Scene, x: number, y: number) {
    const panel = scene.add.graphics();
    drawPanel(panel, 250, 52, { radius: 26, shadow: 4 });
    this.eye = scene.add.graphics();
    this.bar = scene.add.graphics();
    this.label = addText(scene, 22, -2, '', 18, { color: COLORS.inkCss, stroke: 0 });
    this.note = addText(scene, 0, 40, '', 14, { stroke: 4 });
    this.container = scene.add.container(x, y, [panel, this.eye, this.bar, this.label, this.note]);
  }

  /** Nota bajo el indicador (p. ej. "Silencio inesperado…"). */
  setNote(text: string): void {
    this.note.setText(text);
  }

  /**
   * @param progress progreso del aviso o del giro (0–1).
   * @param emphasis aviso extra claro (perk "Apuntes del Profe").
   */
  draw(level: AttentionLevel, progress: number, emphasis: boolean, time: number): void {
    if (level !== this.level) {
      this.level = level;
      this.label.setText(LABELS[level]).setColor(level === 'away' ? '#2f7d32' : level === 'aboutToTurn' ? '#9a6b00' : '#c1121f');
      this.scene.tweens.killTweensOf(this.container);
      this.container.setScale(1);
      if (level !== 'away') this.scene.tweens.add({ targets: this.container, scale: emphasis ? 1.18 : 1.08, duration: 120, yoyo: true });
    }
    this.drawEye(level, time);
    const g = this.bar;
    g.clear();
    if (level === 'aboutToTurn' || level === 'turning') {
      const w = 200;
      g.fillStyle(COLORS.ink, 0.25).fillRoundedRect(-w / 2, 16, w, 6, 3);
      g.fillStyle(level === 'aboutToTurn' ? 0xffb703 : 0xff6b35, 1).fillRoundedRect(-w / 2, 16, w * Phaser.Math.Clamp(progress, 0, 1), 6, 3);
    }
  }

  private drawEye(level: AttentionLevel, time: number): void {
    const g = this.eye;
    g.clear();
    const x = -96;
    const y = 0;
    const ink = COLORS.ink;
    if (level === 'away') {
      // Ojo cerrado: el profe mira a la pizarra.
      g.lineStyle(3, ink, 1);
      g.beginPath();
      g.arc(x, y - 4, 12, Math.PI * 0.15, Math.PI * 0.85, false);
      g.strokePath();
      g.lineStyle(2, ink, 1);
      for (const dx of [-8, 0, 8]) g.lineBetween(x + dx, y + 7, x + dx * 1.2, y + 12);
      return;
    }
    const open = level === 'aboutToTurn' ? 0.45 : level === 'turning' ? 0.75 : 1;
    const danger = level === 'facing' || level === 'watching' || level === 'investigating';
    const blink = level === 'investigating' && Math.floor(time / 150) % 2 === 0;
    g.fillStyle(blink ? 0xff4d6d : 0xffffff, 1).fillEllipse(x, y, 30, 22 * open);
    g.lineStyle(3, ink, 1).strokeEllipse(x, y, 30, 22 * open);
    g.fillStyle(danger ? 0xc1121f : ink, 1).fillCircle(x, y, 6 * open);
    g.fillStyle(0xffffff, 1).fillCircle(x - 2, y - 2, 1.8 * open);
  }
}
