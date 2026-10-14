import Phaser from 'phaser';
import { CHARACTER_CANVAS } from '../art/character';
import { ART_SCALE, charTex, itemTex } from '../art/textures';
import { clickSound, fanfareSound } from '../audio/sfx';
import { COLLECTIBLES } from '../config/collectibles.config';
import { getTierPresentation } from '../config/emission.config';
import { GAME_CONFIG } from '../config/game.config';
import { REFERENCE_HEIGHT_M } from '../config/skins.config';
import { CityBackdrop } from '../entities/CityBackdrop';
import type { TogasRuntime } from '../runtime';
import { COLORS, DEPTH, addText } from '../ui/theme';
import { createButton, drawPanel } from '../ui/widgets';

/** Pantalla de resultados: puntuación, estadísticas, récord y opciones para seguir. */
export class ResultsScene extends Phaser.Scene {
  private acceptInput = false;

  constructor(private readonly rt: TogasRuntime) {
    super('results');
  }

  create(): void {
    const results = this.rt.lastResults;
    if (!results) {
      this.scene.start('select');
      return;
    }
    const { width, height } = GAME_CONFIG.view;
    this.rt.context.setPauseAvailable(false);
    this.acceptInput = false;
    // Breve espera para que un salto mantenido no pulse "Jugar otra vez" sin querer.
    this.time.delayedCall(1200, () => (this.acceptInput = true));

    new CityBackdrop(this).setScroll(0, 0);
    this.add.rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.55).setDepth(DEPTH.overlay - 1);

    const root = this.add.container(width / 2, height / 2).setDepth(DEPTH.overlay);
    const panel = this.add.graphics();
    drawPanel(panel, 700, 450, { radius: 24, shadow: 8 });
    root.add(panel);

    // Personaje celebrando a la izquierda.
    const skinScale = (this.rt.skin.heightM / REFERENCE_HEIGHT_M / ART_SCALE) * 1.25;
    const hero = this.add
      .image(-255, 70, charTex(results.skinId, results.maxTier >= 4 ? 'strong' : 'collect'))
      .setOrigin(CHARACTER_CANVAS.feetX / CHARACTER_CANVAS.width, CHARACTER_CANVAS.feetY / CHARACTER_CANVAS.height)
      .setScale(skinScale);
    root.add(hero);
    this.tweens.add({ targets: hero, y: 62, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    root.add(addText(this, 60, -190, '¡SE ACABÓ EL TIEMPO!', 30, { color: COLORS.yellowCss }));

    const scoreText = addText(this, 60, -130, '0', 64, { color: '#ff8a3d' });
    root.add(scoreText);
    const counter = { value: 0 };
    this.tweens.add({
      targets: counter,
      value: results.score,
      duration: Math.min(1400, 300 + results.score / 10),
      ease: 'Cubic.easeOut',
      onUpdate: () => scoreText.setText(Math.round(counter.value).toLocaleString('es-ES')),
    });

    const bestLine = results.isNewBest ? '¡NUEVO RÉCORD!' : `Récord: ${results.bestScore.toLocaleString('es-ES')}`;
    const best = addText(this, 60, -82, bestLine, results.isNewBest ? 24 : 18, {
      color: results.isNewBest ? '#ff4d6d' : COLORS.inkCss,
      stroke: results.isNewBest ? 4 : 0,
    });
    root.add(best);
    if (results.isNewBest) {
      this.tweens.add({ targets: best, scale: 1.12, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.rt.play(fanfareSound);
    }

    // Comida recogida, con iconos.
    COLLECTIBLES.forEach((item, i) => {
      const x = -110 + i * 72;
      root.add(this.add.image(x, -30, itemTex(item.id)).setScale(0.75 / ART_SCALE));
      root.add(addText(this, x, 2, `×${results.collected[item.id] ?? 0}`, 18, { color: COLORS.inkCss, stroke: 0 }));
    });

    const tier = results.maxTier > 0 ? getTierPresentation(results.maxTier) : null;
    const stats: Array<[string, string]> = [
      ['Eructos', String(results.burps)],
      ['Pedos', String(results.farts)],
      ['Antigases tocados', String(results.obstaclesHit)],
      ['Intensidad máxima', tier ? `${tier.tier} · ${tier.label}` : '—'],
    ];
    stats.forEach(([name, value], i) => {
      const y = 44 + i * 26;
      root.add(addText(this, -110, y, name, 17, { align: 'left', color: '#5a4f78', stroke: 0, weight: '700' }));
      root.add(addText(this, 230, y, value, 18, { align: 'right', color: COLORS.inkCss, stroke: 0 }));
    });

    const replay = () => this.go(() => this.scene.start('play'));
    root.add(createButton(this, -165, 185, 'Volver al hub', { width: 190, height: 52, fontSize: 18, fill: COLORS.paper, onClick: () => this.go(() => this.rt.context.exit()) }));
    root.add(createButton(this, 35, 185, 'Personaje', { width: 170, height: 52, fontSize: 18, fill: 0xb5e36b, onClick: () => this.go(() => this.scene.start('select')) }));
    root.add(createButton(this, 225, 185, 'Otra vez', { width: 170, height: 52, fontSize: 20, onClick: replay }));

    this.input.keyboard?.on('keydown-ENTER', replay);
    this.input.keyboard?.on('keydown-SPACE', replay);

    root.setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: root, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
  }

  private go(action: () => void): void {
    if (!this.acceptInput) return;
    this.acceptInput = false;
    this.rt.play(clickSound);
    action();
  }
}
