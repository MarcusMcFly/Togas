import Phaser from 'phaser';
import { COLORS, addText } from './theme';

export interface PanelStyle {
  fill?: number;
  stroke?: number;
  radius?: number;
  shadow?: number;
}

/** Panel redondeado con contorno y sombra "de pegatina". Se dibuja centrado en (0, 0). */
export function drawPanel(graphics: Phaser.GameObjects.Graphics, width: number, height: number, style: PanelStyle = {}): void {
  const { fill = COLORS.paper, stroke = COLORS.ink, radius = 18, shadow = 6 } = style;
  graphics.clear();
  if (shadow > 0) {
    graphics.fillStyle(COLORS.ink, 1);
    graphics.fillRoundedRect(-width / 2, -height / 2 + shadow, width, height, radius);
  }
  graphics.fillStyle(fill, 1);
  graphics.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
  graphics.lineStyle(3, stroke, 1);
  graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
}

export interface ButtonOptions {
  width?: number;
  height?: number;
  fill?: number;
  textColor?: string;
  fontSize?: number;
  onClick: () => void;
}

/** Botón táctil grande con efecto de pulsación. */
export function createButton(scene: Phaser.Scene, x: number, y: number, text: string, options: ButtonOptions): Phaser.GameObjects.Container {
  const { width = 220, height = 58, fill = COLORS.accent, textColor = COLORS.inkCss, fontSize = 22, onClick } = options;
  const bg = scene.add.graphics();
  drawPanel(bg, width, height, { fill, radius: 14, shadow: 5 });
  const label = addText(scene, 0, 0, text, fontSize, { color: textColor, stroke: 0 });
  const button = scene.add.container(x, y, [bg, label]);
  button.setSize(width, height + 5);
  button.setInteractive({ useHandCursor: true });

  button.on('pointerover', () => button.setScale(1.04));
  button.on('pointerout', () => {
    button.setScale(1);
    bg.y = 0;
    label.y = 0;
  });
  button.on('pointerdown', () => {
    bg.y = 3;
    label.y = 3;
  });
  button.on('pointerup', () => {
    bg.y = 0;
    label.y = 0;
    onClick();
  });
  return button;
}
