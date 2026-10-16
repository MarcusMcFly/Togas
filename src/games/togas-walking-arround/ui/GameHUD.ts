import Phaser from 'phaser';
import { ART_SCALE, headTex } from '../art/textures';
import { EMISSION_TIERS, getTierPresentation } from '../config/emission.config';
import { GAME_CONFIG } from '../config/game.config';
import type { TogasRuntime } from '../runtime';
import type { HudState } from '../scenes/PlayScene';
import { COLORS, addText } from './theme';
import { drawPanel } from '../../../core/ui/phaser/widgets';

const METER = { x: 618, y: 24, width: 230, height: 26 };
const GAS_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0x8bd450],
  [0.55, 0xffd23f],
  [0.8, 0xff9f1c],
  [1, 0xff4d6d],
];

/**
 * HUD en una escena aparte, encima de la partida: así las sacudidas de cámara
 * no lo mueven. Solo lee `HudState` y escucha eventos; no toca la lógica.
 */
export class GameHUD extends Phaser.Scene {
  private state!: HudState;
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private tierText!: Phaser.GameObjects.Text;
  private meterFill!: Phaser.GameObjects.Graphics;
  private pips!: Phaser.GameObjects.Graphics;
  private meterGroup!: Phaser.GameObjects.Container;
  private displayedGas = 0;
  private lastScore = -1;
  private lastSeconds = -1;
  private lastTier = -1;
  private unsubscribers: Array<() => void> = [];

  constructor(private readonly rt: TogasRuntime) {
    super('hud');
  }

  create(data: { state: HudState }): void {
    this.state = data.state;
    this.displayedGas = 0;
    this.lastScore = this.lastSeconds = this.lastTier = -1;

    // Avatar y puntos.
    const avatarBg = this.add.graphics();
    avatarBg.fillStyle(COLORS.ink, 1).fillCircle(44, 46, 31);
    avatarBg.fillStyle(COLORS.paper, 1).fillCircle(44, 42, 30);
    avatarBg.lineStyle(3, COLORS.ink, 1).strokeCircle(44, 42, 30);
    this.add.image(44, 42, headTex(this.state.skinId)).setScale(1 / ART_SCALE);
    addText(this, 86, 24, 'PUNTOS', 14, { align: 'left', stroke: 4 });
    this.scoreText = addText(this, 86, 50, '0', 30, { align: 'left', color: COLORS.yellowCss });

    // Tiempo.
    const pill = this.add.graphics({ x: GAME_CONFIG.view.width / 2, y: 38 });
    drawPanel(pill, 128, 50, { radius: 25, shadow: 4 });
    this.timerText = addText(this, GAME_CONFIG.view.width / 2, 38, '1:30', 30, { color: COLORS.inkCss, stroke: 0 });

    // Medidor de gas e intensidad.
    const frame = this.add.graphics();
    frame.fillStyle(COLORS.ink, 1).fillRoundedRect(METER.x - 3, METER.y - 3 + 4, METER.width + 6, METER.height + 6, 15);
    frame.fillStyle(0x3b3360, 1).fillRoundedRect(METER.x - 3, METER.y - 3, METER.width + 6, METER.height + 6, 15);
    this.meterFill = this.add.graphics();
    const label = addText(this, METER.x - 12, METER.y + METER.height / 2, 'GAS', 18, { align: 'right', color: '#b5e36b' });
    this.pips = this.add.graphics();
    this.tierText = addText(this, METER.x + 112, 72, '', 14, { align: 'left', stroke: 4 });
    this.meterGroup = this.add.container(0, 0, [frame, this.meterFill, label, this.pips, this.tierText]);

    this.unsubscribers = [
      this.rt.events.on('collect', () => this.pulse(1.04)),
      this.rt.events.on('obstacle', () => this.shakeMeter()),
      this.rt.events.on('emission', () => this.pulse(1.1)),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const unsubscribe of this.unsubscribers) unsubscribe();
      this.unsubscribers = [];
    });
  }

  update(_time: number, deltaMs: number): void {
    const s = this.state;

    if (s.score !== this.lastScore) {
      this.lastScore = s.score;
      this.scoreText.setText(s.score.toLocaleString('es-ES'));
    }

    const seconds = Math.ceil(s.timeLeft);
    if (seconds !== this.lastSeconds) {
      this.lastSeconds = seconds;
      this.timerText.setText(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
      const urgent = seconds <= 10 && seconds > 0;
      this.timerText.setColor(urgent ? '#e63946' : COLORS.inkCss);
      if (urgent) this.tweens.add({ targets: this.timerText, scale: { from: 1.25, to: 1 }, duration: 300, ease: 'Quad.easeOut' });
    }

    // El medidor se acerca suavemente al valor real.
    const target = s.gas / s.maxGas;
    const previous = this.displayedGas;
    this.displayedGas += (target - this.displayedGas) * Math.min(1, deltaMs / 90);
    if (Math.abs(this.displayedGas - previous) > 0.0005 || this.lastTier !== s.tier) this.drawMeter();

    if (s.tier !== this.lastTier) {
      this.lastTier = s.tier;
      this.drawPips(s.tier);
      const p = s.tier > 0 ? getTierPresentation(s.tier) : null;
      this.tierText.setText(p ? `Nivel ${p.tier} · ${p.label}` : 'Sin emisiones');
      this.tierText.setColor(p ? p.color : '#ffffff');
    }
  }

  private drawMeter(): void {
    const g = this.meterFill;
    g.clear();
    const ratio = Phaser.Math.Clamp(this.displayedGas, 0, 1);
    const w = Math.max(0, METER.width * ratio);
    if (w < 2) return;
    g.fillStyle(gasColor(ratio), 1).fillRoundedRect(METER.x, METER.y, w, METER.height, Math.min(12, w / 2));
    g.fillStyle(0xffffff, 0.35).fillRoundedRect(METER.x + 4, METER.y + 3, Math.max(0, w - 8), 6, 3);
  }

  private drawPips(tier: number): void {
    const g = this.pips;
    g.clear();
    EMISSION_TIERS.forEach((p, i) => {
      const x = METER.x + 10 + i * 20;
      const filled = i < tier;
      g.fillStyle(COLORS.ink, 1).fillCircle(x, 73, 8);
      g.fillStyle(filled ? Phaser.Display.Color.HexStringToColor(p.color).color : 0x3b3360, 1).fillCircle(x, 72, 7);
    });
  }

  private pulse(scale: number): void {
    this.tweens.killTweensOf(this.meterGroup);
    this.meterGroup.setScale(1).setPosition(0, 0);
    // Escalar alrededor del centro del medidor.
    const cx = METER.x + METER.width / 2;
    const cy = METER.y + METER.height / 2;
    this.tweens.add({
      targets: this.meterGroup,
      scale,
      x: cx * (1 - scale),
      y: cy * (1 - scale),
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private shakeMeter(): void {
    this.tweens.killTweensOf(this.meterGroup);
    this.meterGroup.setScale(1).setPosition(0, 0);
    this.tweens.add({ targets: this.meterGroup, x: { from: -8, to: 0 }, duration: 260, ease: 'Elastic.easeOut' });
  }
}

function gasColor(ratio: number): number {
  for (let i = 1; i < GAS_STOPS.length; i++) {
    const [stop, color] = GAS_STOPS[i];
    const [prevStop, prevColor] = GAS_STOPS[i - 1];
    if (ratio <= stop) {
      const t = (ratio - prevStop) / (stop - prevStop);
      const a = Phaser.Display.Color.IntegerToColor(prevColor);
      const b = Phaser.Display.Color.IntegerToColor(color);
      const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, t * 100);
      return Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b);
    }
  }
  return GAS_STOPS[GAS_STOPS.length - 1][1];
}
