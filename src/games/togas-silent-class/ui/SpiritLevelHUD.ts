import Phaser from 'phaser';
import { BALANCE_CONFIG } from '../config/balance.config';
import type { LevelStatus } from '../systems/BalanceSystem';
import { COLORS, LEVEL_COLORS, addText } from './theme';

export interface SpiritLevelOptions {
  x: number;
  y: number;
  /** Largo del tubo (en el eje de la burbuja). */
  length: number;
  thickness: number;
  orientation: 'horizontal' | 'vertical';
  label: string;
}

const ZONE_ICON: Record<LevelStatus, string> = { ready: '✓', settling: '…', drift: '', warning: '!', critical: '!!' };

/**
 * Nivel de burbuja como los de obra. El color del marco indica el estado, pero
 * nunca va solo: también cambia el icono (✓ / … / ! / !!) y el marco vibra en crítico.
 * El verde (✓) solo aparece cuando la simulación confirma que soltar sería silencioso.
 */
export class SpiritLevelHUD {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly icon: Phaser.GameObjects.Text;
  private readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, private readonly o: SpiritLevelOptions) {
    this.g = scene.add.graphics();
    const horizontal = o.orientation === 'horizontal';
    const end = o.length / 2 + 18;
    const label = horizontal
      ? addText(scene, -end - 8, 0, o.label, 13, { align: 'right', stroke: 4 })
      : addText(scene, 0, end + 4, o.label, 13, { stroke: 4 });
    this.icon = horizontal ? addText(scene, end + 6, 0, '', 20, { align: 'left' }) : addText(scene, 0, -end - 6, '', 20);
    this.container = scene.add.container(o.x, o.y, [this.g, label, this.icon]);
  }

  setVisible(visible: boolean): this {
    this.container.setVisible(visible);
    return this;
  }

  /** `value` en -1…1 (vertical: positivo = arriba). */
  draw(value: number, zone: LevelStatus, active: boolean, highContrast: boolean, time: number): void {
    const { length, thickness, orientation } = this.o;
    const palette = highContrast ? LEVEL_COLORS.contrast : LEVEL_COLORS.normal;
    const horizontal = orientation === 'horizontal';
    const w = horizontal ? length : thickness;
    const h = horizontal ? thickness : length;
    const g = this.g;
    g.clear();

    // Vibración del marco en crítico (pista no cromática).
    const jitter = zone === 'critical' ? Math.sin(time * 0.06) * 2 : 0;
    const frameColor = palette[zone];
    const frame = highContrast ? 6 : 5;

    g.fillStyle(COLORS.ink, 1).fillRoundedRect(-w / 2 - frame + jitter, -h / 2 - frame + 4, w + frame * 2, h + frame * 2, 12);
    g.fillStyle(frameColor, 1).fillRoundedRect(-w / 2 - frame + jitter, -h / 2 - frame, w + frame * 2, h + frame * 2, 12);
    g.fillStyle(palette.liquid, highContrast ? 1 : 0.92).fillRoundedRect(-w / 2 + jitter, -h / 2, w, h, 9);
    g.lineStyle(2, COLORS.ink, 1).strokeRoundedRect(-w / 2 + jitter, -h / 2, w, h, 9);

    // Marcas: zona segura (gruesas) y zona de aviso (finas).
    const half = length / 2;
    const bubbleR = thickness * 0.62;
    const travel = half - bubbleR - 2;
    const mark = (at: number, width: number, alpha: number) => {
      const p = at * travel;
      g.lineStyle(width, COLORS.ink, alpha);
      if (horizontal) g.lineBetween(p + jitter, -h / 2 + 3, p + jitter, h / 2 - 3);
      else g.lineBetween(-w / 2 + 3 + jitter, -p, w / 2 - 3 + jitter, -p);
    };
    const safe = BALANCE_CONFIG.safeThreshold;
    for (const s of [-1, 1]) {
      mark(s * safe, highContrast ? 4 : 3, 1);
      mark(s * BALANCE_CONFIG.warningThreshold, 1.5, 0.35);
    }
    if (zone === 'ready' || zone === 'settling') {
      // Zona segura resaltada (más intensa cuando ya está confirmada).
      g.fillStyle(palette.ready, (highContrast ? 0.6 : 0.35) * (zone === 'ready' ? 1 : 0.5));
      const s = safe * travel;
      if (horizontal) g.fillRect(-s + jitter, -h / 2 + 2, s * 2, h - 4);
      else g.fillRect(-w / 2 + 2 + jitter, -s, w - 4, s * 2);
    }

    // Burbuja.
    const pos = Phaser.Math.Clamp(value, -1, 1) * travel;
    const bx = horizontal ? pos + jitter : jitter;
    const by = horizontal ? 0 : -pos;
    const rx = horizontal ? bubbleR * 1.35 : bubbleR * 0.8;
    const ry = horizontal ? bubbleR * 0.8 : bubbleR * 1.35;
    g.fillStyle(palette.bubble, active ? 1 : 0.75).fillEllipse(bx, by, rx * 2, ry * 2);
    g.lineStyle(2.5, COLORS.ink, 1).strokeEllipse(bx, by, rx * 2, ry * 2);
    g.fillStyle(0xffffff, 0.8).fillEllipse(bx - rx * 0.35, by - ry * 0.35, rx * 0.6, ry * 0.45);

    const icon = ZONE_ICON[zone];
    if (this.icon.text !== icon) this.icon.setText(icon);
    this.icon.setColor(Phaser.Display.Color.IntegerToColor(frameColor).rgba);
  }
}
