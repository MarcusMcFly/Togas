import Phaser from 'phaser';
import { CLASSROOM } from '../art/classroom';
import { RES, TEX, deskRowTex, deskRows } from '../art/textures';
import { BOARD_FORMULAS, NIGHTMARE_FORMULAS } from '../config/professor.config';
import { DEPTH, FONT_FAMILY } from '../ui/theme';

const CHALK_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: `'Segoe Print', 'Comic Sans MS', 'Chalkboard SE', ${FONT_FAMILY}`,
  fontSize: '19px',
  fontStyle: 'bold',
  color: '#f4f4e8',
  resolution: 2,
};

/**
 * El aula estática (fondo, filas de pupitres, reloj) y la pizarra viva:
 * el profe va escribiendo fórmulas y, con presión alta, aparece la "pesadilla del ingeniero".
 */
export class Classroom {
  private readonly lines: Phaser.GameObjects.Text[] = [];
  private readonly clockHands: Phaser.GameObjects.Graphics;
  private readonly nightmare: Phaser.GameObjects.Text;
  private writing: { text: Phaser.GameObjects.Text; full: string; shown: number } | null = null;
  private formulaIndex = 0;
  private nightmareIndex = 0;
  private nightmareOn = false;

  constructor(private readonly scene: Phaser.Scene) {
    scene.add.image(0, 0, TEX.background).setOrigin(0).setScale(1 / RES.background).setDepth(DEPTH.background);
    for (const row of deskRows()) {
      scene.add.image(0, row.textureY, deskRowTex(row.index)).setOrigin(0).setScale(1 / RES.background)
        .setDepth(DEPTH.deskRow + row.index * 10);
    }
    this.clockHands = scene.add.graphics().setDepth(DEPTH.boardText);
    this.formulaIndex = Math.floor(Math.random() * BOARD_FORMULAS.length);

    const { board } = CLASSROOM;
    this.nightmare = scene.add.text(board.x + board.w / 2 - 50, board.y + board.h / 2, '', {
      ...CHALK_STYLE, fontSize: '30px', color: '#ffb3c1', align: 'center',
    }).setOrigin(0.5).setDepth(DEPTH.boardText + 1).setAlpha(0);

    // Un par de fórmulas de partida, para que la pizarra no esté vacía.
    this.addLine(true);
    this.addLine(true);
  }

  /** El profe empieza a escribir una línea nueva. */
  startWriting(): void {
    this.finishWriting();
    this.addLine(false);
  }

  /** Avanza la escritura (llamar a cada trazo de tiza). */
  writeStep(): void {
    if (!this.writing) return;
    const w = this.writing;
    w.shown = Math.min(w.full.length, w.shown + 2);
    w.text.setText(w.full.slice(0, w.shown));
    if (w.shown >= w.full.length) this.writing = null;
  }

  /** Borrado enérgico: se lleva la línea más antigua. */
  eraseOldest(): void {
    const line = this.lines.shift();
    if (!line) return;
    this.scene.tweens.add({ targets: line, alpha: 0, duration: 500, onComplete: () => line.destroy() });
    this.relayout();
  }

  setNightmare(on: boolean): void {
    if (on === this.nightmareOn) return;
    this.nightmareOn = on;
    this.scene.tweens.killTweensOf(this.nightmare);
    if (on) {
      this.nightmare.setText(NIGHTMARE_FORMULAS[this.nightmareIndex++ % NIGHTMARE_FORMULAS.length]);
      this.nightmare.setAngle(-4).setScale(0.6);
      this.scene.tweens.add({ targets: this.nightmare, alpha: 1, scale: 1, duration: 350, ease: 'Back.easeOut' });
      this.scene.tweens.add({ targets: this.nightmare, angle: 4, duration: 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      this.scene.tweens.add({ targets: this.nightmare, alpha: 0, duration: 300 });
    }
    for (const line of this.lines) line.setAlpha(on ? 0.25 : 1);
  }

  /** Agujas del reloj: avanzan con la sesión (90 s ≈ los últimos minutos de clase). */
  updateClock(progress: number): void {
    const { x, y, r } = CLASSROOM.clock;
    const minutes = 50 + progress * 10;
    const g = this.clockHands;
    g.clear();
    g.lineStyle(3, 0x2b2340, 1);
    const hourAngle = ((11 + minutes / 60) / 12) * Math.PI * 2 - Math.PI / 2;
    g.lineBetween(x, y, x + Math.cos(hourAngle) * r * 0.5, y + Math.sin(hourAngle) * r * 0.5);
    g.lineStyle(2, 0x2b2340, 1);
    const minuteAngle = (minutes / 60) * Math.PI * 2 - Math.PI / 2;
    g.lineBetween(x, y, x + Math.cos(minuteAngle) * r * 0.8, y + Math.sin(minuteAngle) * r * 0.8);
    g.fillStyle(0xe63946, 1).fillCircle(x, y, 2.5);
  }

  private addLine(complete: boolean): void {
    const { boardText } = CLASSROOM;
    if (this.lines.length >= boardText.lines) this.eraseOldest();
    const full = BOARD_FORMULAS[this.formulaIndex++ % BOARD_FORMULAS.length];
    const text = this.scene.add.text(boardText.x, 0, complete ? full : '', CHALK_STYLE).setDepth(DEPTH.boardText);
    if (this.nightmareOn) text.setAlpha(0.25);
    this.lines.push(text);
    this.relayout();
    if (!complete) this.writing = { text, full, shown: 0 };
  }

  private finishWriting(): void {
    if (!this.writing) return;
    this.writing.text.setText(this.writing.full);
    this.writing = null;
  }

  private relayout(): void {
    const { boardText } = CLASSROOM;
    this.lines.forEach((line, i) => line.setY(boardText.y + i * boardText.lineHeight));
  }
}
