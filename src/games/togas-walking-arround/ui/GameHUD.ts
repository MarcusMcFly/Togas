import Phaser from 'phaser';
import { ART_SCALE, headTex } from '../art/textures';
import { EMISSION_TIERS, getTierPresentation } from '../config/emission.config';
import { GAME_CONFIG } from '../config/game.config';
import type { TogasRuntime } from '../runtime';
import { formatMultiplier, type HudState } from '../scenes/PlayScene';
import { COLORS, addText } from './theme';
import { drawPanel } from '../../../core/ui/phaser/widgets';

const METER = { x: 618, y: 24, width: 230, height: 26 };
/** Nombre de cada nivel de búsqueda policial (índice = estrellas). */
const WANTED_LABELS = ['Inocente', 'Sospechoso', 'Alborotador', 'Molestia pública', 'Lo más buscado', '¡Detenido!'] as const;
const PROGRESS = { width: 220, height: 22 } as const;

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
  private progressFill: Phaser.GameObjects.Graphics | null = null;
  private progressText: Phaser.GameObjects.Text | null = null;
  private multiplierText: Phaser.GameObjects.Text | null = null;
  private starsText: Phaser.GameObjects.Text | null = null;
  private wantedText: Phaser.GameObjects.Text | null = null;
  private lastProgress = -1;
  private lastMultiplier = -1;
  private lastWanted = -1;
  private unsubscribers: Array<() => void> = [];

  constructor(private readonly rt: TogasRuntime) {
    super('hud');
  }

  create(data: { state: HudState }): void {
    this.state = data.state;
    this.displayedGas = 0;
    this.lastScore = this.lastSeconds = this.lastTier = -1;
    this.lastProgress = this.lastMultiplier = this.lastWanted = -1;
    this.progressFill = this.progressText = this.multiplierText = this.starsText = this.wantedText = null;

    // Avatar y puntos.
    const avatarBg = this.add.graphics();
    avatarBg.fillStyle(COLORS.ink, 1).fillCircle(44, 46, 31);
    avatarBg.fillStyle(COLORS.paper, 1).fillCircle(44, 42, 30);
    avatarBg.lineStyle(3, COLORS.ink, 1).strokeCircle(44, 42, 30);
    this.add.image(44, 42, headTex(this.state.skinId)).setScale(1 / ART_SCALE);
    addText(this, 86, 24, 'PUNTOS', 14, { align: 'left', stroke: 4 });
    this.scoreText = addText(this, 86, 50, '0', 30, { align: 'left', color: COLORS.yellowCss });

    // Tiempo (o, en la campaña, distancia a la meta y búsqueda policial).
    const cx = GAME_CONFIG.view.width / 2;
    if (this.state.street) {
      const pill = this.add.graphics({ x: cx, y: 32 });
      drawPanel(pill, PROGRESS.width + 20, 40, { radius: 20, shadow: 4 });
      this.progressFill = this.add.graphics();
      this.progressText = addText(this, cx, 32, '', 15, { color: COLORS.inkCss, stroke: 0 });
      this.timerText = addText(this, cx, -100, '', 10).setVisible(false);
      this.starsText = addText(this, cx, 72, '', 26, { stroke: 4 });
      this.wantedText = addText(this, cx, 96, '', 13, { stroke: 3 });
      this.multiplierText = addText(this, 86, 78, '', 18, { align: 'left', color: '#b5e36b', stroke: 4 });
    } else {
      const pill = this.add.graphics({ x: cx, y: 38 });
      drawPanel(pill, 128, 50, { radius: 25, shadow: 4 });
      this.timerText = addText(this, cx, 38, '1:30', 30, { color: COLORS.inkCss, stroke: 0 });
    }

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

    if (s.street) this.updateStreet(s.street);

    const seconds = Math.ceil(s.timeLeft);
    if (!s.street && seconds !== this.lastSeconds) {
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

  private updateStreet(street: NonNullable<HudState['street']>): void {
    const progress = Math.round(street.progress * 100);
    if (progress !== this.lastProgress && this.progressFill && this.progressText) {
      this.lastProgress = progress;
      const g = this.progressFill;
      const x = GAME_CONFIG.view.width / 2 - PROGRESS.width / 2;
      const y = 32 - PROGRESS.height / 2;
      g.clear();
      g.fillStyle(0xe8dcc4, 1).fillRoundedRect(x, y, PROGRESS.width, PROGRESS.height, 11);
      const w = Math.max(PROGRESS.height, PROGRESS.width * street.progress);
      g.fillStyle(0x8bd450, 1).fillRoundedRect(x, y, w, PROGRESS.height, 11);
      this.progressText.setText(`🏛 Universidad · ${progress} %`);
    }
    if (street.multiplier !== this.lastMultiplier && this.multiplierText) {
      const grew = street.multiplier > this.lastMultiplier && this.lastMultiplier > 0;
      this.lastMultiplier = street.multiplier;
      this.multiplierText.setText(`Multiplicador ×${formatMultiplier(street.multiplier)}`);
      this.multiplierText.setColor(street.multiplier > 1 ? '#b5e36b' : '#ffffff');
      if (grew) this.tweens.add({ targets: this.multiplierText, scale: { from: 1.3, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    }
    if (street.wanted !== this.lastWanted && this.starsText && this.wantedText) {
      const rose = street.wanted > this.lastWanted && this.lastWanted >= 0;
      this.lastWanted = street.wanted;
      this.starsText.setText('★'.repeat(street.wanted) + '☆'.repeat(Math.max(0, street.maxWanted - street.wanted)));
      this.starsText.setColor(street.wanted === 0 ? '#c9c2e6' : street.wanted >= street.maxWanted - 1 ? '#ff4d6d' : '#ffd23f');
      this.wantedText.setText(`🚓 ${WANTED_LABELS[Math.min(street.wanted, WANTED_LABELS.length - 1)]}`);
      if (rose) this.tweens.add({ targets: [this.starsText, this.wantedText], scale: { from: 1.5, to: 1 }, duration: 380, ease: 'Back.easeOut' });
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
