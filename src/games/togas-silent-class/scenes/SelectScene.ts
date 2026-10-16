import Phaser from 'phaser';
import { SKINS } from '../../../core/characters/CharacterRegistry';
import { createButton, drawPanel } from '../../../core/ui/phaser/widgets';
import { RES, TEX, faceTex } from '../art/textures';
import { strainSound } from '../audio/classSounds';
import { clickSound } from '../audio/sfx';
import { GAME_CONFIG } from '../config/game.config';
import { PERKS, type PerkId } from '../config/perks.config';
import type { SilentClassRuntime } from '../runtime';
import { COLORS, DEPTH, addText } from '../ui/theme';

interface Card {
  container: Phaser.GameObjects.Container;
  panel: Phaser.GameObjects.Graphics;
}

const CARD = { w: 210, h: 150 } as const;

/**
 * Antes de clase: elegir personaje, gastar créditos de Campus Run (si se viene de
 * Walking Around), opciones de accesibilidad y tutorial.
 */
export class SelectScene extends Phaser.Scene {
  private cards: Card[] = [];
  private selected = 0;
  private perkButtons: Array<{ id: PerkId; container: Phaser.GameObjects.Container; panel: Phaser.GameObjects.Graphics; affordable: boolean }> = [];

  constructor(private readonly rt: SilentClassRuntime) {
    super('select');
  }

  create(): void {
    const { width, height } = GAME_CONFIG.view;
    this.rt.context.setPauseAvailable(false);
    this.cards = [];
    this.perkButtons = [];
    this.selected = Math.max(0, SKINS.findIndex((s) => s.id === this.rt.skin.id));

    this.add.image(0, 0, TEX.background).setOrigin(0).setScale(1 / RES.background);
    this.add.rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.62);

    addText(this, width / 2, 36, 'Togas: Silent Class', 36, { color: COLORS.yellowCss }).setDepth(DEPTH.overlay);
    addText(this, width / 2, 70, 'Equilibrio. Silencio. Que no te expulsen.', 16, { stroke: 4 }).setDepth(DEPTH.overlay);
    createButton(this, 74, 36, '← Hub', { width: 116, height: 42, fontSize: 17, fill: COLORS.paper, onClick: () => this.rt.context.exit() });

    const spacing = CARD.w + 30;
    const startX = width / 2 - ((SKINS.length - 1) * spacing) / 2;
    SKINS.forEach((_, i) => this.cards.push(this.createCard(startX + i * spacing, 176, i)));

    this.createCampusPanel(width / 2, 330);
    this.createOptions(width / 2, 432);

    createButton(this, width / 2 + 110, 496, '¡A clase!', { width: 220, height: 56, fontSize: 24, onClick: () => this.start('play') });
    createButton(this, width / 2 - 120, 496, 'Tutorial', { width: 170, height: 56, fontSize: 20, fill: 0xb5e36b, onClick: () => this.start('tutorial') });

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-LEFT', () => this.select((this.selected - 1 + SKINS.length) % SKINS.length));
    keyboard?.on('keydown-RIGHT', () => this.select((this.selected + 1) % SKINS.length));
    keyboard?.on('keydown-ENTER', () => this.start('play'));

    this.highlight();
  }

  private createCard(x: number, y: number, index: number): Card {
    const skin = SKINS[index];
    const panel = this.add.graphics();
    const face = this.add.image(0, -20, faceTex(skin.id, 'strain')).setScale(1.25 / RES.fx);
    const name = addText(this, 0, 42, skin.displayName, 24, { color: COLORS.inkCss, stroke: 0 });
    const tagline = addText(this, 0, 62, skin.tagline, 12, { color: '#5a4f78', stroke: 0, weight: '700' });
    const container = this.add.container(x, y, [panel, face, name, tagline]);
    container.setSize(CARD.w, CARD.h);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerup', () => {
      if (this.selected === index) this.start('play');
      else this.select(index);
    });
    return { container, panel };
  }

  private createCampusPanel(x: number, y: number): void {
    const transfer = this.rt.pendingTransfer;
    const panel = this.add.graphics({ x, y });
    if (!transfer) {
      drawPanel(panel, 640, 64, { fill: 0x3b3360, stroke: COLORS.ink, radius: 16, shadow: 4 });
      addText(this, x, y, 'Consejo: termina Togas Walking arround y pulsa «Continuar»\npara llegar con Créditos de Campus y comprar una ventaja.', 14, { stroke: 3 });
      this.rt.perk = null;
      return;
    }
    drawPanel(panel, 760, 128, { fill: 0xfff3c4, radius: 18, shadow: 5 });
    addText(this, x, y - 46, `🎓 Campus Run · ${transfer.credits} créditos (${transfer.sourceScore.toLocaleString('es-ES')} pts caminando)`, 16, {
      color: COLORS.inkCss, stroke: 0,
    });
    addText(this, x, y - 26, '«Todas esas fabes eran una inversión.» · Elige UNA ventaja (opcional)', 12, { color: '#5a4f78', stroke: 0, weight: '700' });

    PERKS.forEach((perk, i) => {
      const affordable = perk.cost <= transfer.credits;
      const bx = x - 246 + i * 246;
      const by = y + 20;
      const bg = this.add.graphics();
      const title = addText(this, 0, -14, `${perk.name} · ${perk.cost} cr.`, 14, { color: COLORS.inkCss, stroke: 0 });
      const desc = addText(this, 0, 8, perk.description, 11, { color: '#5a4f78', stroke: 0, weight: '700', wrapWidth: 220 });
      const container = this.add.container(bx, by, [bg, title, desc]).setAlpha(affordable ? 1 : 0.45);
      container.setSize(232, 60);
      if (affordable) {
        container.setInteractive({ useHandCursor: true });
        container.on('pointerup', () => {
          this.rt.play(clickSound);
          this.rt.perk = this.rt.perk === perk.id ? null : perk.id;
          this.drawPerks();
        });
      }
      this.perkButtons.push({ id: perk.id, container, panel: bg, affordable });
    });
    this.drawPerks();
  }

  private drawPerks(): void {
    for (const b of this.perkButtons) {
      const active = this.rt.perk === b.id;
      drawPanel(b.panel, 232, 60, { fill: active ? 0xb5e36b : COLORS.paper, radius: 12, shadow: active ? 5 : 3 });
    }
  }

  private createOptions(x: number, y: number): void {
    const toggle = (bx: number, label: string, key: 'forgiving' | 'highContrast') => {
      const text = () => `${label}: ${this.rt.preferences[key] ? 'Sí' : 'No'}`;
      const button = createButton(this, bx, y, text(), {
        width: 250, height: 44, fontSize: 16, fill: COLORS.paper,
        onClick: () => {
          this.rt.play(clickSound);
          this.rt.setPreference(key, !this.rt.preferences[key]);
          (button.list[1] as Phaser.GameObjects.Text).setText(text());
        },
      });
    };
    toggle(x - 135, '😌 Modo relajado', 'forgiving');
    toggle(x + 135, '◐ Alto contraste', 'highContrast');
  }

  private select(index: number): void {
    if (index === this.selected) return;
    this.selected = index;
    this.highlight();
    this.rt.play(strainSound(SKINS[index], 0), 'preview');
  }

  private highlight(): void {
    this.cards.forEach((card, i) => {
      const active = i === this.selected;
      drawPanel(card.panel, CARD.w, CARD.h, { fill: active ? 0xffe7a3 : COLORS.paper, shadow: active ? 8 : 5 });
      card.container.setScale(active ? 1.05 : 0.94);
    });
  }

  private start(mode: 'play' | 'tutorial'): void {
    this.rt.play(clickSound);
    this.rt.selectSkin(SKINS[this.selected].id);
    // La primera vez, el tutorial va antes de la clase de verdad.
    const first = mode === 'play' && !this.rt.tutorialDone;
    this.scene.start('classroom', { mode: first ? 'tutorial' : mode });
  }
}
