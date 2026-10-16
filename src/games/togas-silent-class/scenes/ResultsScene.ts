import Phaser from 'phaser';
import { createButton, drawPanel } from '../../../core/ui/phaser/widgets';
import { RES, TEX, faceTex } from '../art/textures';
import { clickSound } from '../audio/sfx';
import { GAME_CONFIG } from '../config/game.config';
import type { SilentClassRuntime } from '../runtime';
import { COLORS, DEPTH, addText } from '../ui/theme';

const HEADLINES = { time: '¡CLASE TERMINADA!', expelled: '¡EXPULSADO DE CLASE!', cleared: '¡TODA LA CLASE DORMIDA!' } as const;

/** Resultados: puntuación, estadísticas reales de la partida, título y Campus Run. */
export class ResultsScene extends Phaser.Scene {
  private acceptInput = false;

  constructor(private readonly rt: SilentClassRuntime) {
    super('results');
  }

  create(): void {
    const r = this.rt.lastResults;
    if (!r) {
      this.scene.start('select');
      return;
    }
    const { width, height } = GAME_CONFIG.view;
    this.rt.context.setPauseAvailable(false);
    this.acceptInput = false;
    this.time.delayedCall(1200, () => (this.acceptInput = true));

    this.add.image(0, 0, TEX.background).setOrigin(0).setScale(1 / RES.background);
    this.add.rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.6);

    const root = this.add.container(width / 2, height / 2).setDepth(DEPTH.overlay);
    const panel = this.add.graphics();
    drawPanel(panel, 920, 500, { radius: 24, shadow: 8 });
    root.add(panel);

    // Izquierda: retrato y título.
    const good = r.endReason !== 'expelled' && r.trumpetFarts <= r.silentFarts;
    root.add(this.add.image(-330, -120, faceTex(r.skinId, good ? 'proud' : 'embarrassed')).setScale(1.9 / RES.fx));
    root.add(addText(this, -330, -30, 'TÍTULO FINAL', 14, { color: '#5a4f78', stroke: 0 }));
    root.add(addText(this, -330, 0, r.title.name.toUpperCase(), 22, { color: '#9b5de5', stroke: 0, wrapWidth: 220 }));

    // Centro: puntuación y estadísticas.
    root.add(addText(this, -20, -214, HEADLINES[r.endReason], 26, { color: COLORS.yellowCss }));
    const scoreText = addText(this, -20, -166, '0', 54, { color: '#ff8a3d' });
    root.add(scoreText);
    const counter = { value: 0 };
    this.tweens.add({
      targets: counter, value: r.score, duration: Math.min(1400, 300 + r.score / 4), ease: 'Cubic.easeOut',
      onUpdate: () => scoreText.setText(Math.round(counter.value).toLocaleString('es-ES')),
    });
    const best = addText(this, -20, -126, r.isNewBest ? '¡NUEVO RÉCORD!' : `Récord: ${r.bestScore.toLocaleString('es-ES')}`, r.isNewBest ? 20 : 15, {
      color: r.isNewBest ? '#ff4d6d' : COLORS.inkCss, stroke: r.isNewBest ? 4 : 0,
    });
    root.add(best);
    if (r.isNewBest) this.tweens.add({ targets: best, scale: 1.1, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const pct = (v: number) => `${Math.round(v * 100)} %`;
    const stats: Array<[string, string]> = [
      ['Compañeros dormidos', `${r.studentsKnockedOut} / ${r.totalStudents} (${pct(r.completion)})`],
      ['Pedos silenciosos', String(r.silentFarts)],
      ['Trompetazos', String(r.trumpetFarts)],
      ['Liberaciones perfectas', String(r.perfectReleases)],
      ['Precisión media', pct(r.accuracy)],
      ['Presión máxima superada', r.maxPressureSurvived ? String(r.maxPressureSurvived) : '—'],
      ['Aguante más largo', `${r.longestHoldSec.toFixed(1)} s`],
      ['Avisos del profe', String(r.detections)],
      ['Mejor racha silenciosa', String(r.bestStreak)],
    ];
    stats.forEach(([name, value], i) => {
      const y = -92 + i * 26;
      root.add(addText(this, -180, y, name, 15, { align: 'left', color: '#5a4f78', stroke: 0, weight: '700' }));
      root.add(addText(this, 140, y, value, 16, { align: 'right', color: COLORS.inkCss, stroke: 0 }));
    });

    // Derecha: Campus Run (si se vino de Walking Around).
    const run = r.campusRun;
    const box = this.add.graphics();
    drawPanel(box, 250, 300, { fill: run ? 0xfff3c4 : 0xf1ecff, radius: 16, shadow: 4 });
    box.setPosition(310, -40);
    root.add(box);
    if (run) {
      const total = run.sourceScore + r.score;
      root.add(addText(this, 310, -170, 'CAMPUS RUN COMPLETA', 16, { color: COLORS.inkCss, stroke: 0 }));
      const lines: Array<[string, string]> = [
        [run.sourceGameTitle, run.sourceScore.toLocaleString('es-ES')],
        ['Silent Class', r.score.toLocaleString('es-ES')],
      ];
      lines.forEach(([name, value], i) => {
        root.add(addText(this, 200, -130 + i * 26, name, 13, { align: 'left', color: '#5a4f78', stroke: 0, weight: '700', wrapWidth: 140 }));
        root.add(addText(this, 420, -130 + i * 26, value, 15, { align: 'right', color: COLORS.inkCss, stroke: 0 }));
      });
      const line = this.add.graphics();
      line.lineStyle(2, COLORS.ink, 1).lineBetween(200, -64, 420, -64);
      root.add(line);
      root.add(addText(this, 310, -40, total.toLocaleString('es-ES'), 30, { color: '#ff8a3d' }));
      root.add(addText(this, 310, -14, 'TOTAL DEL CAMPUS', 12, { color: '#5a4f78', stroke: 0 }));
      root.add(addText(this, 310, 18, `Créditos: ${run.credits} · Ventaja: ${run.perk?.name ?? 'ninguna'}`, 12, { color: COLORS.inkCss, stroke: 0, wrapWidth: 230 }));
      root.add(addText(this, 310, 64, '«UN DÍA MUY PRODUCTIVO\nEN LA UNIVERSIDAD»', 14, { color: '#9b5de5', stroke: 0 }));
    } else {
      root.add(addText(this, 310, -150, 'CONSEJO', 15, { color: COLORS.inkCss, stroke: 0 }));
      root.add(addText(this, 310, -60, this.tip(r), 14, { color: '#5a4f78', stroke: 0, weight: '700', wrapWidth: 220 }));
    }

    const replay = () => this.go(() => this.scene.start('classroom', { mode: 'play' }));
    root.add(createButton(this, -250, 200, 'Volver al hub', { width: 200, height: 52, fontSize: 18, fill: COLORS.paper, onClick: () => this.go(() => this.rt.context.exit()) }));
    root.add(createButton(this, -20, 200, 'Personaje', { width: 190, height: 52, fontSize: 18, fill: 0xb5e36b, onClick: () => this.go(() => this.scene.start('select')) }));
    root.add(createButton(this, 220, 200, 'Otra clase', { width: 200, height: 52, fontSize: 20, onClick: replay }));
    this.input.keyboard?.on('keydown-ENTER', replay);

    root.setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: root, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });
  }

  private tip(r: NonNullable<SilentClassRuntime['lastResults']>): string {
    if (r.trumpetFarts > r.silentFarts) return 'Suelta solo cuando las DOS burbujas estén en verde y veas el ✓.';
    if (r.detections > 0) return 'Mira el ojo de arriba: suelta cuando el profe esté de espaldas.';
    if (r.maxPressureSurvived < 80) return 'Aguanta más: con presión alta la nube llega a más compañeros.';
    return 'Encadena liberaciones sin que te pillen: la racha multiplica los puntos.';
  }

  private go(action: () => void): void {
    if (!this.acceptInput) return;
    this.acceptInput = false;
    this.rt.play(clickSound);
    action();
  }
}
