import Phaser from 'phaser';
import { CHARACTER_CANVAS } from '../art/character';
import { ART_SCALE, charTex, idleAnim, runAnim } from '../art/textures';
import { emissionSound } from '../audio/emissionSounds';
import { clickSound } from '../audio/sfx';
import { GAME_CONFIG } from '../config/game.config';
import { REFERENCE_HEIGHT_M, SKINS } from '../config/skins.config';
import { CityBackdrop } from '../entities/CityBackdrop';
import type { TogasRuntime } from '../runtime';
import { COLORS, DEPTH, addText } from '../ui/theme';
import { createButton, drawPanel } from '../ui/widgets';

interface Card {
  container: Phaser.GameObjects.Container;
  panel: Phaser.GameObjects.Graphics;
  sprite: Phaser.GameObjects.Sprite;
  skinId: string;
}

const CARD_W = 230;
const CARD_H = 290;

/** Pantalla de selección de personaje. Se adapta a cualquier número de skins. */
export class SelectScene extends Phaser.Scene {
  private cards: Card[] = [];
  private selected = 0;
  private elapsed = 0;
  private backdrop!: CityBackdrop;

  constructor(private readonly rt: TogasRuntime) {
    super('select');
  }

  create(): void {
    const { width, height } = GAME_CONFIG.view;
    this.rt.context.setPauseAvailable(false);
    this.cards = [];
    this.elapsed = 0;
    this.selected = Math.max(0, SKINS.findIndex((s) => s.id === this.rt.skin.id));

    this.backdrop = new CityBackdrop(this);
    this.add.rectangle(width / 2, height / 2, width, height, COLORS.ink, 0.45).setDepth(DEPTH.overlay - 1);

    addText(this, width / 2, 48, 'Elige a tu estudiante', 36, { color: COLORS.yellowCss }).setDepth(DEPTH.overlay);

    const spacing = CARD_W + 40;
    const startX = width / 2 - ((SKINS.length - 1) * spacing) / 2;
    SKINS.forEach((skin, i) => this.cards.push(this.createCard(startX + i * spacing, 245, skin.id, i)));

    createButton(this, width / 2, 455, '¡A correr!', { width: 240, height: 60, fontSize: 26, onClick: () => this.start() }).setDepth(DEPTH.overlay);
    createButton(this, 80, 40, '← Hub', {
      width: 120, height: 44, fontSize: 18, fill: COLORS.paper, onClick: () => this.rt.context.exit(),
    }).setDepth(DEPTH.overlay);
    addText(this, width / 2, 515, 'Toca o pulsa ESPACIO para saltar · Mantén pulsado para saltar más alto', 16, {
      color: '#ffffff', stroke: 3,
    }).setDepth(DEPTH.overlay);

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-LEFT', () => this.select((this.selected - 1 + SKINS.length) % SKINS.length));
    keyboard?.on('keydown-RIGHT', () => this.select((this.selected + 1) % SKINS.length));
    keyboard?.on('keydown-ENTER', () => this.start());
    keyboard?.on('keydown-SPACE', () => this.start());

    this.highlight();
  }

  update(_time: number, deltaMs: number): void {
    this.elapsed += deltaMs / 1000;
    this.backdrop.setScroll(this.elapsed * 40, this.elapsed);
  }

  private createCard(x: number, y: number, skinId: string, index: number): Card {
    const skin = SKINS[index];
    const panel = this.add.graphics();
    const scale = skin.heightM / REFERENCE_HEIGHT_M / ART_SCALE * 1.35;
    const sprite = this.add
      .sprite(0, 70, charTex(skinId, 'idle0'))
      .setOrigin(CHARACTER_CANVAS.feetX / CHARACTER_CANVAS.width, CHARACTER_CANVAS.feetY / CHARACTER_CANVAS.height)
      .setScale(scale);
    sprite.play(idleAnim(skinId));
    const name = addText(this, 0, 98, skin.displayName, 30, { color: COLORS.inkCss, stroke: 0 });
    const tagline = addText(this, 0, 126, skin.tagline, 14, { color: '#5a4f78', stroke: 0, weight: '700' });

    const container = this.add.container(x, y, [panel, sprite, name, tagline]).setDepth(DEPTH.overlay);
    container.setSize(CARD_W, CARD_H);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerup', () => {
      if (this.selected === index) this.start();
      else this.select(index);
    });
    return { container, panel, sprite, skinId };
  }

  private select(index: number): void {
    if (index === this.selected) return;
    this.selected = index;
    this.highlight();
    // Vista previa de la voz: un eructo pequeñito de la skin elegida.
    const skin = SKINS[index];
    this.rt.play(emissionSound(skin, { index: 1, tier: 1, type: 'burp', variant: 0 }), 'preview');
  }

  private highlight(): void {
    this.cards.forEach((card, i) => {
      const active = i === this.selected;
      drawPanel(card.panel, CARD_W, CARD_H, { fill: active ? 0xffe7a3 : COLORS.paper, stroke: COLORS.ink, shadow: active ? 8 : 5 });
      card.container.setScale(active ? 1.05 : 0.95);
      card.sprite.play(active ? runAnim(card.skinId) : idleAnim(card.skinId), true);
    });
  }

  private start(): void {
    this.rt.play(clickSound);
    this.rt.selectSkin(SKINS[this.selected].id);
    this.scene.start('play');
  }
}
