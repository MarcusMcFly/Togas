import Phaser from 'phaser';
import { RES, TEX } from '../art/textures';
import { DEPTH, addText } from '../ui/theme';

interface Point {
  x: number;
  y: number;
}

/** Efectos del aula: nubes, ondas, papeles volando, notas musicales y textos. */
export class ClassroomFx {
  /** Si el juego va lento se reducen partículas. */
  lowQuality = false;

  constructor(private readonly scene: Phaser.Scene) {}

  /**
   * Nube silenciosa (ficticia y cartoon): se extiende por el aula hasta su alcance.
   */
  silentCloud(origin: Point, reach: number, color: number, reducedMotion: boolean): void {
    const count = this.lowQuality ? 6 : 14;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (i / (count - 1)) * Math.PI + Phaser.Math.FloatBetween(-0.15, 0.15);
      const distance = reach * Phaser.Math.FloatBetween(0.45, 1);
      this.puff(origin, { x: origin.x + Math.cos(angle) * distance, y: origin.y + Math.sin(angle) * distance * 0.45 }, color, 0.32, 1.2, 1700 + i * 30, i * 25);
    }
    if (!reducedMotion) {
      const cam = this.scene.cameras.main;
      this.scene.tweens.add({ targets: cam, zoom: 1.03, duration: 380, yoyo: true, hold: 300, ease: 'Sine.easeInOut' });
    }
  }

  /** Voluta que viaja hasta un compañero que cae dormido. */
  wisp(origin: Point, target: Point, color: number): void {
    for (let k = 0; k < 3; k++) this.puff(origin, target, color, 0.55, 0.8 + k * 0.2, 900 + k * 120, 100 + k * 90);
  }

  /** Trompetazo: ondas, notas, papeles volando y sacudida (si se permite). */
  trumpet(origin: Point, intensity: number, reducedMotion: boolean): void {
    const rings = Math.min(4, 1 + Math.floor(intensity / 2));
    for (let i = 0; i < rings; i++) {
      const ring = this.scene.add.image(origin.x, origin.y, TEX.ring).setDepth(DEPTH.fx).setTint(0xffd23f).setScale(0.2).setAlpha(0.9);
      this.scene.tweens.add({
        targets: ring, scaleX: 1.8 + intensity * 0.5, scaleY: (1.8 + intensity * 0.5) * 0.55, alpha: 0,
        duration: 650 + intensity * 80, delay: i * 120, ease: 'Cubic.easeOut', onComplete: () => ring.destroy(),
      });
    }
    const notes = this.lowQuality ? 3 : 4 + intensity * 2;
    for (let i = 0; i < notes; i++) {
      const note = addText(this.scene, origin.x, origin.y - 10, Phaser.Math.RND.pick(['♪', '♫', '♬']), 26 + intensity * 3, {
        color: Phaser.Math.RND.pick(['#ffd23f', '#ff8a3d', '#ff4d6d', '#b5e36b']),
      }).setDepth(DEPTH.fx);
      const dx = Phaser.Math.FloatBetween(-260, 260);
      this.scene.tweens.add({
        targets: note, x: origin.x + dx, y: origin.y - Phaser.Math.FloatBetween(80, 220), angle: dx / 6, alpha: 0,
        duration: 900 + Math.random() * 500, ease: 'Quad.easeOut', onComplete: () => note.destroy(),
      });
    }
    if (intensity >= 2) this.papers(origin, intensity * (this.lowQuality ? 2 : 4));
    if (!reducedMotion) this.scene.cameras.main.shake(220 + intensity * 90, 0.003 + intensity * 0.0025);
    else this.scene.cameras.main.flash(120, 255, 240, 200);
  }

  floatingText(text: string, x: number, y: number, color: string, size = 22): void {
    const t = addText(this.scene, x, y, text, size, { color }).setDepth(DEPTH.text);
    this.scene.tweens.add({ targets: t, y: y - 46, alpha: { from: 1, to: 0 }, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  sparkle(x: number, y: number, color = 0xffd23f): void {
    const n = this.lowQuality ? 4 : 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = this.scene.add.image(x, y, TEX.spark).setScale(1.2 / RES.fx).setTint(color).setDepth(DEPTH.fx);
      this.scene.tweens.add({
        targets: s, x: x + Math.cos(a) * 34, y: y + Math.sin(a) * 34, alpha: 0, angle: 180, duration: 520, ease: 'Quad.easeOut', onComplete: () => s.destroy(),
      });
    }
  }

  private puff(from: Point, to: Point, color: number, alpha: number, scale: number, duration: number, delay: number): void {
    const p = this.scene.add.image(from.x, from.y, TEX.puff).setTint(color).setAlpha(0).setScale(0.3 / RES.fx).setDepth(DEPTH.fx);
    this.scene.tweens.add({
      targets: p, x: to.x, y: to.y, alpha: { from: alpha, to: 0 }, scale: (scale * 2.2) / RES.fx, angle: Phaser.Math.Between(-60, 60),
      duration, delay, ease: 'Sine.easeOut', onComplete: () => p.destroy(),
    });
  }

  private papers(origin: Point, count: number): void {
    for (let i = 0; i < count; i++) {
      const start = { x: origin.x + Phaser.Math.Between(-200, 200), y: origin.y - Phaser.Math.Between(40, 120) };
      const paper = this.scene.add.image(start.x, start.y, TEX.paper).setScale(1.6 / RES.fx).setDepth(DEPTH.fx);
      this.scene.tweens.add({
        targets: paper, y: start.y - Phaser.Math.Between(60, 160), x: start.x + Phaser.Math.Between(-80, 80), angle: Phaser.Math.Between(-360, 360),
        duration: 500, ease: 'Quad.easeOut',
        onComplete: () => this.scene.tweens.add({
          targets: paper, y: paper.y + 140, alpha: 0, angle: paper.angle + 180, duration: 900, ease: 'Sine.easeIn', onComplete: () => paper.destroy(),
        }),
      });
    }
  }
}
