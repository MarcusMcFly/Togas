import Phaser from 'phaser';
import { ART_SCALE, TEX } from '../art/textures';
import { getTierPresentation } from '../config/emission.config';
import { GAME_CONFIG } from '../config/game.config';
import type { Emission } from '../systems/EmissionSystem';
import { DEPTH, addText } from '../ui/theme';

const BURP_TINTS = [0xe4f5b5, 0xc8ec8a, 0xf2f7d9];
const FART_TINTS = [0xa8c96a, 0x8fb55a, 0xc9b77a];
const CONFETTI = [0xff4d6d, 0xffd23f, 0x8bd450, 0x5fb8f5, 0xb388ff];

/**
 * Traduce lo que pasa en el juego a efectos visuales: nubes de gas, ondas, texto
 * cómico, confeti y sacudidas. Nunca toca la puntuación ni la física.
 * Usa pools para no crear objetos nuevos en cada emisión.
 */
export class EffectsDirector {
  private readonly burpEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly fartEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparkEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly fizzEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly clouds: Phaser.GameObjects.Image[] = [];
  private readonly rings: Phaser.GameObjects.Image[] = [];
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private readonly flashRect: Phaser.GameObjects.Rectangle;
  /** En dispositivos lentos se reducen las partículas. */
  lowQuality = false;

  constructor(private readonly scene: Phaser.Scene) {
    const puffScale = 1 / ART_SCALE;
    const gasCloud = (angle: { min: number; max: number }, tint: number[]) =>
      scene.add
        .particles(0, 0, TEX.puff, {
          emitting: false,
          lifespan: { min: 600, max: 1150 },
          speed: { min: 50, max: 170 },
          angle,
          gravityY: -40,
          scale: { start: 0.3 * puffScale * 2, end: 1.1 * puffScale * 2 },
          alpha: { start: 0.85, end: 0 },
          rotate: { min: 0, max: 360 },
          tint,
        })
        .setDepth(DEPTH.fx);

    this.burpEmitter = gasCloud({ min: -50, max: 15 }, BURP_TINTS);
    this.fartEmitter = gasCloud({ min: 150, max: 215 }, FART_TINTS);
    this.sparkEmitter = scene.add
      .particles(0, 0, TEX.spark, {
        emitting: false,
        lifespan: { min: 700, max: 1300 },
        speed: { min: 180, max: 420 },
        angle: { min: 200, max: 340 },
        gravityY: 600,
        scale: { start: 0.9, end: 0.3 },
        rotate: { min: 0, max: 360 },
        tint: CONFETTI,
      })
      .setDepth(DEPTH.fx);
    this.fizzEmitter = scene.add
      .particles(0, 0, TEX.bubble, {
        emitting: false,
        lifespan: { min: 350, max: 650 },
        speed: { min: 40, max: 130 },
        angle: { min: 230, max: 310 },
        gravityY: -120,
        scale: { start: 0.7, end: 0.2 },
        alpha: { start: 1, end: 0 },
      })
      .setDepth(DEPTH.fx);

    const { width, height } = GAME_CONFIG.view;
    this.flashRect = scene.add.rectangle(width / 2, height / 2, width, height, 0xfff6d5, 1).setDepth(DEPTH.overlay).setAlpha(0);
  }

  emission(emission: Emission, origin: { x: number; y: number }, reducedMotion: boolean): void {
    const fx = getTierPresentation(emission.tier);
    const isBurp = emission.type === 'burp';
    const emitter = isBurp ? this.burpEmitter : this.fartEmitter;
    const calm = reducedMotion || this.lowQuality;
    emitter.explode(calm ? Math.ceil(fx.particles / 2) : fx.particles, origin.x, origin.y);

    if (fx.cloudScale > 0) this.bigCloud(origin, fx.cloudScale, isBurp ? BURP_TINTS[0] : FART_TINTS[0], isBurp ? 1 : -1);
    if (fx.ringRadius > 0 && !reducedMotion) this.ring(origin, fx.ringRadius, fx.color);
    if (fx.shake > 0 && !reducedMotion) this.scene.cameras.main.shake(180 + emission.tier * 60, fx.shake);

    const words = isBurp ? fx.words.burp : fx.words.fart;
    const word = words[emission.variant % words.length];
    const textX = Phaser.Math.Clamp(origin.x + (isBurp ? 90 : -40), 140, GAME_CONFIG.view.width - 140);
    this.comicText(word, textX, origin.y - 50, fx.textSize, fx.color, isBurp ? -8 : 8);

    if (fx.celebrate) {
      if (!calm) this.sparkEmitter.explode(40, origin.x, origin.y);
      if (!reducedMotion) {
        this.flashRect.setAlpha(0.4);
        this.scene.tweens.add({ targets: this.flashRect, alpha: 0, duration: 380, ease: 'Quad.easeOut' });
      }
    }
  }

  /** Texto flotante pequeño (p. ej. "+100"). */
  floatingScore(text: string, x: number, y: number, color = '#ffd23f'): void {
    const t = this.takeText(text, 20, color);
    t.setPosition(x, y).setScale(0.6).setAngle(0);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, y: y - 50, alpha: 0, delay: 250, duration: 500, onComplete: () => t.setVisible(false) });
  }

  fizz(x: number, y: number): void {
    this.fizzEmitter.explode(this.lowQuality ? 8 : 16, x, y);
  }

  sparkle(x: number, y: number): void {
    if (!this.lowQuality) this.sparkEmitter.explode(6, x, y);
  }

  /** Cartel grande en el centro (cuenta atrás, "¡TIEMPO!", "¡LEGENDARIO!"). */
  banner(text: string, size: number, color: string, holdMs = 450): void {
    const { width, height } = GAME_CONFIG.view;
    const t = this.takeText(text, size, color);
    t.setPosition(width / 2, height * 0.38).setScale(0.3).setAngle(-4);
    this.scene.tweens.add({ targets: t, scale: 1, angle: 0, duration: 260, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, alpha: 0, scale: 1.15, delay: 260 + holdMs, duration: 260, onComplete: () => t.setVisible(false) });
  }

  private bigCloud(origin: { x: number; y: number }, scale: number, tint: number, direction: number): void {
    let cloud = this.clouds.find((c) => !c.visible);
    if (!cloud) {
      cloud = this.scene.add.image(0, 0, TEX.puff).setDepth(DEPTH.fx - 1);
      this.clouds.push(cloud);
    }
    const base = 1 / ART_SCALE;
    cloud.setPosition(origin.x, origin.y).setTint(tint).setAlpha(0.85).setScale(base * 0.5).setVisible(true);
    this.scene.tweens.add({
      targets: cloud,
      x: origin.x + direction * 60 * scale,
      y: origin.y - 30 * scale,
      scale: base * 2.2 * scale,
      alpha: 0,
      duration: 900 + scale * 250,
      ease: 'Cubic.easeOut',
      onComplete: () => cloud.setVisible(false),
    });
  }

  private ring(origin: { x: number; y: number }, radius: number, color: string): void {
    let ring = this.rings.find((r) => !r.visible);
    if (!ring) {
      ring = this.scene.add.image(0, 0, TEX.ring).setDepth(DEPTH.fx);
      this.rings.push(ring);
    }
    const textureRadius = 64; // radio lógico de la textura del anillo
    ring.setPosition(origin.x, origin.y).setTint(Phaser.Display.Color.HexStringToColor(color).color).setAlpha(0.9).setScale(0.1).setVisible(true);
    this.scene.tweens.add({
      targets: ring,
      scale: (radius / textureRadius) / ART_SCALE,
      alpha: 0,
      duration: 520,
      ease: 'Quad.easeOut',
      onComplete: () => ring.setVisible(false),
    });
  }

  private comicText(text: string, x: number, y: number, size: number, color: string, angle: number): void {
    const t = this.takeText(text, size, color);
    // Que los textos largos (nivel 5) no se salgan de la pantalla.
    const half = t.width / 2 + 12;
    const safeX = Phaser.Math.Clamp(x, half, Math.max(half, GAME_CONFIG.view.width - half));
    t.setPosition(safeX, y).setScale(0.2).setAngle(angle);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, y: y - 40, alpha: 0, delay: 650, duration: 450, onComplete: () => t.setVisible(false) });
  }

  private takeText(text: string, size: number, color: string): Phaser.GameObjects.Text {
    let t = this.texts.find((candidate) => !candidate.visible);
    if (!t) {
      t = addText(this.scene, 0, 0, '', size).setDepth(DEPTH.text);
      this.texts.push(t);
    }
    this.scene.tweens.killTweensOf(t);
    t.setText(text).setFontSize(size).setColor(color).setStroke('#2b2340', Math.max(3, Math.round(size / 6))).setAlpha(1).setVisible(true);
    return t;
  }
}
