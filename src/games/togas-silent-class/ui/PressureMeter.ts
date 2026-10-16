import Phaser from 'phaser';
import { PRESSURE_CONFIG, pressureState } from '../config/pressure.config';
import { COLORS, addText } from './theme';

/**
 * Medidor de gas vertical tipo termómetro. El estado se lee por color, por el texto
 * (Cómodo / Incómodo / Peligroso / ¡CRÍTICO!) y por las marcas de los umbrales.
 */
export class PressureMeter {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly stateText: Phaser.GameObjects.Text;
  private readonly valueText: Phaser.GameObjects.Text;
  readonly container: Phaser.GameObjects.Container;
  private displayed = 0;
  private lastState = '';

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly width: number,
    private readonly height: number,
  ) {
    this.g = scene.add.graphics();
    const title = addText(scene, 0, -height / 2 - 30, 'GAS', 15, { color: '#b5e36b', stroke: 4 });
    this.valueText = addText(scene, 0, -height / 2 - 14, '0', 13, { stroke: 4 });
    this.stateText = addText(scene, 0, height / 2 + 34, '', 13, { stroke: 4 });
    this.container = scene.add.container(x, y, [this.g, title, this.valueText, this.stateText]);
  }

  setVisible(visible: boolean): this {
    this.container.setVisible(visible);
    return this;
  }

  /** Pequeño latido del medidor (acompaña al tic sonoro). */
  pulse(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.setScale(1);
    this.scene.tweens.add({ targets: this.container, scale: 1.06, duration: 70, yoyo: true });
  }

  draw(pressure: number, deltaMs: number, time: number): void {
    this.displayed += (pressure - this.displayed) * Math.min(1, deltaMs / 80);
    const max = PRESSURE_CONFIG.max;
    const state = pressureState(this.displayed);
    const { width: w, height: h } = this;
    const g = this.g;
    g.clear();
    const critical = state.id === 'critical';
    const blink = critical && Math.floor(time / 120) % 2 === 0;

    // Bulbo y tubo.
    g.fillStyle(COLORS.ink, 1).fillRoundedRect(-w / 2 - 4, -h / 2 - 4 + 4, w + 8, h + 8, 12).fillCircle(0, h / 2 + 12 + 4, w * 0.75 + 4);
    g.fillStyle(0x3b3360, 1).fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 12).fillCircle(0, h / 2 + 12, w * 0.75 + 4);
    const color = Phaser.Display.Color.HexStringToColor(state.color).color;
    g.fillStyle(blink ? 0xffffff : color, 1).fillCircle(0, h / 2 + 12, w * 0.75);
    const fill = Math.max(0, Math.min(1, this.displayed / max)) * h;
    if (fill > 1) g.fillStyle(blink ? 0xffffff : color, 1).fillRoundedRect(-w / 2, h / 2 - fill, w, fill, Math.min(10, fill / 2));
    g.fillStyle(0xffffff, 0.3).fillRoundedRect(-w / 2 + 4, -h / 2 + 4, 5, h - 8, 3);

    // Umbrales.
    for (const s of PRESSURE_CONFIG.states) {
      if (s.from === 0) continue;
      const y = h / 2 - (s.from / max) * h;
      g.lineStyle(2, 0xffffff, 0.85).lineBetween(-w / 2 - 6, y, -w / 2 + 6, y);
    }

    this.valueText.setText(String(Math.round(this.displayed)));
    if (state.id !== this.lastState) {
      this.lastState = state.id;
      this.stateText.setText(state.label).setColor(state.color);
      this.scene.tweens.add({ targets: this.stateText, scale: { from: 1.3, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    }
  }
}
